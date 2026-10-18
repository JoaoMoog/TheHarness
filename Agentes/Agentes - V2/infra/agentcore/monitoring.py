# Execute with AWS MCP run_script. Creates CLARA-scoped audit storage and console alarms.
ACCOUNT='354918379749'
REGION='us-east-1'
async def api(service,operation,**params):
    return await call_boto3(service_name=service,operation_name=operation,region_name=REGION,params=params)
assert (await api('sts','GetCallerIdentity'))['Account']==ACCOUNT
agents=await api('bedrock-agentcore-control','ListHarnesses')
summary=next(h for h in agents['harnesses'] if h['harnessName']=='clara_pilot')
agent=(await api('bedrock-agentcore-control','GetHarness',harnessId=summary['harnessId']))['harness']
runtime=agent['environment']['agentCoreRuntimeEnvironment']['agentRuntimeArn']
bucket=f'clara-agentcore-audit-{ACCOUNT}-{REGION}'
trail_name='clara-agentcore-audit'
trail_arn=f'arn:aws:cloudtrail:{REGION}:{ACCOUNT}:trail/{trail_name}'
buckets=await api('s3','ListBuckets')
if not any(b['Name']==bucket for b in buckets['Buckets']):
    await api('s3','CreateBucket',Bucket=bucket)
await api('s3','PutPublicAccessBlock',Bucket=bucket,ExpectedBucketOwner=ACCOUNT,PublicAccessBlockConfiguration={'BlockPublicAcls':True,'IgnorePublicAcls':True,'BlockPublicPolicy':True,'RestrictPublicBuckets':True})
await api('s3','PutBucketEncryption',Bucket=bucket,ExpectedBucketOwner=ACCOUNT,ServerSideEncryptionConfiguration={'Rules':[{'ApplyServerSideEncryptionByDefault':{'SSEAlgorithm':'AES256'}}]})
await api('s3','PutBucketLifecycleConfiguration',Bucket=bucket,ExpectedBucketOwner=ACCOUNT,LifecycleConfiguration={'Rules':[{'ID':'ClaraAuditRetention','Filter':{'Prefix':'clara/'},'Status':'Enabled','Expiration':{'Days':90}}]})
bucket_arn=f'arn:aws:s3:::{bucket}'
policy={'Version':'2012-10-17','Statement':[
    {'Sid':'CloudTrailAcl','Effect':'Allow','Principal':{'Service':'cloudtrail.amazonaws.com'},'Action':'s3:GetBucketAcl','Resource':bucket_arn,'Condition':{'StringEquals':{'aws:SourceArn':trail_arn}}},
    {'Sid':'CloudTrailWrite','Effect':'Allow','Principal':{'Service':'cloudtrail.amazonaws.com'},'Action':'s3:PutObject','Resource':bucket_arn+f'/clara/AWSLogs/{ACCOUNT}/*','Condition':{'StringEquals':{'aws:SourceArn':trail_arn,'s3:x-amz-acl':'bucket-owner-full-control'}}},
    {'Sid':'TLSOnly','Effect':'Deny','Principal':'*','Action':'s3:*','Resource':[bucket_arn,bucket_arn+'/*'],'Condition':{'Bool':{'aws:SecureTransport':'false'}}}
]}
await api('s3','PutBucketPolicy',Bucket=bucket,ExpectedBucketOwner=ACCOUNT,Policy=json.dumps(policy))
trails=await api('cloudtrail','DescribeTrails',trailNameList=[trail_name])
if not trails['trailList']:
    await api('cloudtrail','CreateTrail',Name=trail_name,S3BucketName=bucket,S3KeyPrefix='clara',IncludeGlobalServiceEvents=False,IsMultiRegionTrail=False,EnableLogFileValidation=True,TagsList=[{'Key':'Application','Value':'CLARA'}])
await api('cloudtrail','PutEventSelectors',TrailName=trail_name,AdvancedEventSelectors=[
    {'Name':'Management','FieldSelectors':[{'Field':'eventCategory','Equals':['Management']}]},
    {'Name':'ClaraInvocations','FieldSelectors':[{'Field':'eventCategory','Equals':['Data']},{'Field':'resources.type','Equals':['AWS::BedrockAgentCore::Runtime']},{'Field':'resources.ARN','Equals':[runtime]}]}
])
await api('cloudtrail','StartLogging',Name=trail_name)
metrics=(await api('cloudwatch','ListMetrics',Namespace='AWS/Bedrock-AgentCore',Dimensions=[{'Name':'Resource','Value':runtime}]))['Metrics']
alarms=[]
for metric_name,threshold in [('Errors',3),('Throttles',3),('Invocations',100)]:
    metric=next(m for m in metrics if m['MetricName']==metric_name and len(m['Dimensions'])==3)
    name=f'CLARA-AgentCore-{metric_name}'
    await api('cloudwatch','PutMetricAlarm',AlarmName=name,AlarmDescription='CLARA pilot: inspect in CloudWatch; no external notifications configured',ActionsEnabled=False,Namespace=metric['Namespace'],MetricName=metric_name,Dimensions=metric['Dimensions'],Statistic='Sum',Period=300,EvaluationPeriods=1,DatapointsToAlarm=1,Threshold=threshold,ComparisonOperator='GreaterThanOrEqualToThreshold',TreatMissingData='notBreaching')
    alarms.append(name)
widgets=[]
for index,name in enumerate(['Invocations','Errors','Latency','Throttles']):
    metric=next(m for m in metrics if m['MetricName']==name and len(m['Dimensions'])==3)
    series=[metric['Namespace'],name]
    for d in metric['Dimensions']: series.extend([d['Name'],d['Value']])
    widgets.append({'type':'metric','x':(index%2)*12,'y':(index//2)*6,'width':12,'height':6,'properties':{'title':name,'region':REGION,'view':'timeSeries','period':300,'stat':'Average' if name=='Latency' else 'Sum','metrics':[series]}})
await api('cloudwatch','PutDashboard',DashboardName='CLARA-AgentCore',DashboardBody=json.dumps({'widgets':widgets}))
status=await api('cloudtrail','GetTrailStatus',Name=trail_name)
result={'trailArn':trail_arn,'auditBucket':bucket,'logging':status['IsLogging'],'dashboard':'CLARA-AgentCore','alarms':alarms}
result
