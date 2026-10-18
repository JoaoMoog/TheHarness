# Run with AWS MCP run_script after provision.py reports READY.
ACCOUNT='354918379749'
REGION='us-east-1'
NAME='clara_pilot'
async def api(service, operation, **params):
    return await call_boto3(service_name=service,operation_name=operation,region_name=REGION,params=params)
assert (await api('sts','GetCallerIdentity'))['Account']==ACCOUNT
agents=await api('bedrock-agentcore-control','ListHarnesses')
summary=next(h for h in agents['harnesses'] if h['harnessName']==NAME)
agent=(await api('bedrock-agentcore-control','GetHarness',harnessId=summary['harnessId']))['harness']
assert agent['status']=='READY', 'Agent not READY yet; rerun later'
arn=agent['arn']
runtime=agent['environment']['agentCoreRuntimeEnvironment']
log_group=f"/aws/bedrock-agentcore/runtimes/{runtime['agentRuntimeId']}-DEFAULT"
log_arn=f'arn:aws:logs:{REGION}:{ACCOUNT}:log-group:{log_group}'
alias='alias/clara-agentcore-logs'
aliases=await api('kms','ListAliases')
key=next((a.get('TargetKeyId') for a in aliases['Aliases'] if a['AliasName']==alias),None)
if not key:
    key_policy={'Version':'2012-10-17','Statement':[
        {'Sid':'AccountAdministration','Effect':'Allow','Principal':{'AWS':f'arn:aws:iam::{ACCOUNT}:root'},'Action':'kms:*','Resource':'*'},
        {'Sid':'EncryptedClaraLogs','Effect':'Allow','Principal':{'Service':f'logs.{REGION}.amazonaws.com'},'Action':['kms:Encrypt','kms:Decrypt','kms:ReEncrypt*','kms:GenerateDataKey*','kms:DescribeKey'],'Resource':'*','Condition':{'ArnLike':{'kms:EncryptionContext:aws:logs:arn':f'arn:aws:logs:{REGION}:{ACCOUNT}:log-group:/aws/bedrock-agentcore/runtimes/{runtime["agentRuntimeId"]}*'}}}
    ]}
    created=await api('kms','CreateKey',Description='CLARA AgentCore logs',Policy=json.dumps(key_policy),Tags=[{'TagKey':'Application','TagValue':'CLARA'}])
    key=created['KeyMetadata']['KeyId']
    await api('kms','CreateAlias',AliasName=alias,TargetKeyId=key)
await api('kms','EnableKeyRotation',KeyId=key)
key_arn=(await api('kms','DescribeKey',KeyId=key))['KeyMetadata']['Arn']
groups=await api('logs','DescribeLogGroups',logGroupNamePrefix=log_group)
if not any(g['logGroupName']==log_group for g in groups['logGroups']):
    await api('logs','CreateLogGroup',logGroupName=log_group,kmsKeyId=key_arn,tags={'Application':'CLARA'})
else:
    await api('logs','AssociateKmsKey',logGroupName=log_group,kmsKeyId=key_arn)
await api('logs','PutRetentionPolicy',logGroupName=log_group,retentionInDays=30)
source_name='clara-agentcore-application'
await api('logs','PutDeliverySource',name=source_name,resourceArn=runtime['agentRuntimeArn'],logType='APPLICATION_LOGS')
# Plain format is intentional: the JSON delivery kept nested request payloads despite recordFields.
destination=(await api('logs','PutDeliveryDestination',name='clara-agentcore-metadata',outputFormat='plain',deliveryDestinationType='CWL',deliveryDestinationConfiguration={'destinationResourceArn':log_arn}))['deliveryDestination']
deliveries=await api('logs','DescribeDeliveries')
delivery=next((d for d in deliveries['deliveries'] if d['deliverySourceName']==source_name and d['deliveryDestinationArn']==destination['arn']),None)
fields=['resource_arn','event_timestamp','account_id','request_id','service_name','operation','severityNumber','severityText']
if not delivery:
    delivery=(await api('logs','CreateDelivery',deliverySourceName=source_name,deliveryDestinationArn=destination['arn'],recordFields=fields,fieldDelimiter='\t'))['delivery']
await api('logs','UpdateDeliveryConfiguration',id=delivery['id'],recordFields=fields,fieldDelimiter='\t')

role_name='clara-agentcore-invoker'
roles=await api('iam','ListRoles',PathPrefix='/clara/')
role=next((r for r in roles['Roles'] if r['RoleName']==role_name),None)
trust={'Version':'2012-10-17','Statement':[{'Effect':'Allow','Principal':{'AWS':f'arn:aws:iam::{ACCOUNT}:root'},'Action':'sts:AssumeRole','Condition':{'ArnLike':{'aws:PrincipalArn':[f'arn:aws:iam::{ACCOUNT}:role/*',f'arn:aws:iam::{ACCOUNT}:user/*']}}}]}
if not role:
    role=(await api('iam','CreateRole',RoleName=role_name,Path='/clara/',AssumeRolePolicyDocument=json.dumps(trust),Description='CLARA pilot server invoke-only role',Tags=[{'Key':'Application','Value':'CLARA'}]))['Role']
await api('iam','UpdateAssumeRolePolicy',RoleName=role_name,PolicyDocument=json.dumps(trust))
policy={'Version':'2012-10-17','Statement':[
    {'Effect':'Allow','Action':['bedrock-agentcore:InvokeHarness','bedrock-agentcore:InvokeAgentRuntime'],'Resource':[arn,arn+'/harness-endpoint/live',runtime['agentRuntimeArn'],runtime['agentRuntimeArn']+'/runtime-endpoint/live']},
    {'Effect':'Deny','Action':['bedrock-agentcore:InvokeAgentRuntimeCommand','bedrock-agentcore:InvokeAgentRuntimeCommandShell'],'Resource':'*'}
]}
await api('iam','PutRolePolicy',RoleName=role_name,PolicyName='InvokeClaraOnly',PolicyDocument=json.dumps(policy))
execution_trust={'Version':'2012-10-17','Statement':[{'Effect':'Allow','Principal':{'Service':'bedrock-agentcore.amazonaws.com'},'Action':'sts:AssumeRole','Condition':{'StringEquals':{'aws:SourceAccount':ACCOUNT},'ArnLike':{'aws:SourceArn':[arn,arn+'/*',runtime['agentRuntimeArn'],runtime['agentRuntimeArn']+'/*']}}}]}
await api('iam','UpdateAssumeRolePolicy',RoleName='clara-agentcore-execution',PolicyDocument=json.dumps(execution_trust))
execution_policy=(await api('iam','GetRolePolicy',RoleName='clara-agentcore-execution',PolicyName='ClaraAgentExecution'))['PolicyDocument']
if isinstance(execution_policy,str): execution_policy=json.loads(execution_policy)
for statement in execution_policy['Statement']:
    if statement['Sid']=='LogStreams': statement['Resource']=[log_arn,log_arn+':log-stream:*']
await api('iam','PutRolePolicy',RoleName='clara-agentcore-execution',PolicyName='ClaraAgentExecution',PolicyDocument=json.dumps(execution_policy))
endpoints=await api('bedrock-agentcore-control','ListHarnessEndpoints',harnessId=agent['harnessId'])
live=next((e for e in endpoints.get('endpoints',[]) if e['endpointName']=='live'),None)
if not live:
    live=await api('bedrock-agentcore-control','CreateHarnessEndpoint',harnessId=agent['harnessId'],endpointName='live',targetVersion=agent['harnessVersion'],description='CLARA pilot version')
result={'harnessArn':arn,'harnessId':agent['harnessId'],'version':agent['harnessVersion'],'invokerRoleArn':role['Arn'],'runtimeArn':runtime['agentRuntimeArn'],'logGroup':log_group,'logDeliveryId':delivery['id'],'kmsKeyArn':key_arn,'endpoint':live}
result
