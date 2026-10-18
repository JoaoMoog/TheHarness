# Execute this file using the official AWS MCP run_script tool (call_boto3 is supplied by MCP).
# Re-runnable bootstrap for the CLARA pilot. Does not change an existing harness version.
ACCOUNT = '354918379749'
REGION = 'us-east-1'
NAME = 'clara_pilot'
ROLE = 'clara-agentcore-execution'
MODEL = 'us.amazon.nova-2-lite-v1:0'

async def api(service, operation, **params):
    return await call_boto3(service_name=service, operation_name=operation, region_name=REGION, params=params)

identity = await api('sts', 'GetCallerIdentity')
assert identity['Account'] == ACCOUNT, 'Wrong AWS account; no changes made'
profile = await api('bedrock', 'GetInferenceProfile', inferenceProfileIdentifier=MODEL)
assert profile['status'] == 'ACTIVE'
trust = {'Version':'2012-10-17','Statement':[{'Effect':'Allow','Principal':{'Service':'bedrock-agentcore.amazonaws.com'},'Action':'sts:AssumeRole','Condition':{'StringEquals':{'aws:SourceAccount':ACCOUNT},'ArnLike':{'aws:SourceArn':[f'arn:aws:bedrock-agentcore:{REGION}:{ACCOUNT}:harness/*',f'arn:aws:bedrock-agentcore:{REGION}:{ACCOUNT}:runtime/*']}}}]}
try:
    role = await api('iam','GetRole',RoleName=ROLE)
except Exception as error:
    if 'NoSuchEntity' not in str(error): raise
    role = await api('iam','CreateRole',RoleName=ROLE,Path='/clara/',AssumeRolePolicyDocument=json.dumps(trust),Description='CLARA managed agent execution',Tags=[{'Key':'Application','Value':'CLARA'}])
await api('iam','UpdateAssumeRolePolicy',RoleName=ROLE,PolicyDocument=json.dumps(trust))

logs_arn = f'arn:aws:logs:{REGION}:{ACCOUNT}:log-group:/aws/bedrock-agentcore/runtimes/*'
policy = {'Version':'2012-10-17','Statement':[
    {'Sid':'Model','Effect':'Allow','Action':['bedrock:InvokeModel','bedrock:InvokeModelWithResponseStream'],'Resource':[profile['inferenceProfileArn']]+[v['modelArn'] for v in profile['models']]},
    {'Sid':'ManagedContainer','Effect':'Allow','Action':['ecr-public:GetAuthorizationToken'],'Resource':'*'},
    {'Sid':'EcrBearer','Effect':'Allow','Action':['sts:GetServiceBearerToken'],'Resource':'*','Condition':{'StringEquals':{'sts:AWSServiceName':'ecr-public.amazonaws.com'}}},
    {'Sid':'LogStreams','Effect':'Allow','Action':['logs:DescribeLogStreams','logs:CreateLogStream','logs:PutLogEvents'],'Resource':[logs_arn,logs_arn+':log-stream:*']},
    {'Sid':'LogDiscovery','Effect':'Allow','Action':['logs:DescribeLogGroups'],'Resource':f'arn:aws:logs:{REGION}:{ACCOUNT}:log-group:*'},
    {'Sid':'Metrics','Effect':'Allow','Action':'cloudwatch:PutMetricData','Resource':'*','Condition':{'StringEquals':{'cloudwatch:namespace':'bedrock-agentcore'}}},
    {'Sid':'NoRoleSwitching','Effect':'Deny','Action':'sts:AssumeRole','Resource':'*'}
]}
await api('iam','PutRolePolicy',RoleName=ROLE,PolicyName='ClaraAgentExecution',PolicyDocument=json.dumps(policy))
existing = await api('bedrock-agentcore-control','ListHarnesses')
found = next((h for h in existing.get('harnesses',[]) if h.get('harnessName')==NAME or h.get('name')==NAME),None)
if found:
    harness = await api('bedrock-agentcore-control','GetHarness',harnessId=found['harnessId'])
else:
    harness = await api('bedrock-agentcore-control','CreateHarness',harnessName=NAME,executionRoleArn=role['Role']['Arn'],
        model={'bedrockModelConfig':{'modelId':MODEL,'maxTokens':2000,'temperature':0.1}},
        systemPrompt=[{'text':'Você é CLARA. Responda em português, de forma breve. Peça esclarecimento quando necessário. Retorne somente JSON conforme o contrato fornecido pelo servidor. Não execute ferramentas, código ou SQL.'}],
        memory={'disabled':{}},allowedTools=[],tools=[],skills=[],maxIterations=1,maxTokens=2000,timeoutSeconds=45,
        environment={'agentCoreRuntimeEnvironment':{'networkConfiguration':{'networkMode':'PUBLIC'},'lifecycleConfiguration':{'idleRuntimeSessionTimeout':60,'maxLifetime':300}}},
        environmentVariables={'OTEL_SDK_DISABLED':'true'},tags={'Application':'CLARA','Environment':'pilot'})
result = {'roleArn':role['Role']['Arn'],'harness':harness}
result
