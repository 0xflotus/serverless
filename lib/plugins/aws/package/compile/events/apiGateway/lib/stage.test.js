'use strict';

const expect = require('chai').expect;
const AwsCompileApigEvents = require('../index');
const Serverless = require('../../../../../../../Serverless');
const AwsProvider = require('../../../../../provider/awsProvider');

describe('#compileStage()', () => {
  let serverless;
  let provider;
  let awsCompileApigEvents;
  let stage;
  let stageLogicalId;
  let accountLogicalid;
  let logsRoleLogicalId;
  let logGroupLogicalId;

  beforeEach(() => {
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverless = new Serverless();
    provider = new AwsProvider(serverless, options);
    serverless.setProvider('aws', provider);
    serverless.service.service = 'my-service';
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
      Outputs: {},
    };
    awsCompileApigEvents = new AwsCompileApigEvents(serverless, options);
    awsCompileApigEvents.apiGatewayRestApiLogicalId = 'ApiGatewayRestApi';
    awsCompileApigEvents.apiGatewayDeploymentLogicalId = 'ApiGatewayDeploymentTest';
    awsCompileApigEvents.provider = provider;
    stage = awsCompileApigEvents.provider.getStage();
    stageLogicalId = awsCompileApigEvents.provider.naming
      .getStageLogicalId();
    accountLogicalid = awsCompileApigEvents.provider.naming
      .getApiGatewayAccountLogicalId();
    logsRoleLogicalId = awsCompileApigEvents.provider.naming
      .getApiGatewayLogsRoleLogicalId();
    logGroupLogicalId = awsCompileApigEvents.provider.naming
      .getApiGatewayLogGroupLogicalId();
    // mocking the result of a Deployment resource since we remove the stage name
    // when using the Stage resource
    awsCompileApigEvents.serverless.service.provider.compiledCloudFormationTemplate
      .Resources[awsCompileApigEvents.apiGatewayDeploymentLogicalId] = {
        Properties: {
          StageName: stage,
        },
      };
  });

  describe('tracing', () => {
    beforeEach(() => {
      // setting up AWS X-Ray tracing
      awsCompileApigEvents.serverless.service.provider.tracing = {
        apiGateway: true,
      };
    });

    it('should create a dedicated stage resource if tracing is configured', () =>
      awsCompileApigEvents.compileStage().then(() => {
        const resources = awsCompileApigEvents.serverless.service.provider
          .compiledCloudFormationTemplate.Resources;

        expect(resources[stageLogicalId]).to.deep.equal({
          Type: 'AWS::ApiGateway::Stage',
          Properties: {
            RestApiId: {
              Ref: awsCompileApigEvents.apiGatewayRestApiLogicalId,
            },
            DeploymentId: {
              Ref: awsCompileApigEvents.apiGatewayDeploymentLogicalId,
            },
            StageName: 'dev',
            Tags: [],
            TracingEnabled: true,
          },
        });

        expect(resources[awsCompileApigEvents.apiGatewayDeploymentLogicalId]).to.deep.equal({
          Properties: {},
        });
      })
    );

    it('should NOT create a dedicated stage resource if tracing is not enabled', () => {
      awsCompileApigEvents.serverless.service.provider.tracing = {};

      return awsCompileApigEvents.compileStage().then(() => {
        const resources = awsCompileApigEvents.serverless.service.provider
          .compiledCloudFormationTemplate.Resources;

        // eslint-disable-next-line
        expect(resources[stageLogicalId]).not.to.exist;

        expect(resources[awsCompileApigEvents.apiGatewayDeploymentLogicalId]).to.deep.equal({
          Properties: {
            StageName: stage,
          },
        });
      });
    });
  });

  describe('tags', () => {
    it('should create a dedicated stage resource if provider.stackTags is configured', () => {
      awsCompileApigEvents.serverless.service.provider.stackTags = {
        foo: '1',
      };

      awsCompileApigEvents.compileStage().then(() => {
        const resources = awsCompileApigEvents.serverless.service.provider
          .compiledCloudFormationTemplate.Resources;
        expect(resources[awsCompileApigEvents.apiGatewayDeploymentLogicalId]).to.deep.equal({
          Properties: {},
        });

        expect(resources[stageLogicalId]).to.deep.equal({
          Type: 'AWS::ApiGateway::Stage',
          Properties: {
            RestApiId: {
              Ref: awsCompileApigEvents.apiGatewayRestApiLogicalId,
            },
            DeploymentId: {
              Ref: awsCompileApigEvents.apiGatewayDeploymentLogicalId,
            },
            StageName: stage,
            TracingEnabled: false,
            Tags: [
              { Key: 'foo', Value: '1' },
            ],
          },
        });
      });
    });

    it('should create a dedicated stage resource if provider.tags is configured', () => {
      awsCompileApigEvents.serverless.service.provider.tags = {
        foo: '1',
      };

      awsCompileApigEvents.compileStage().then(() => {
        const resources = awsCompileApigEvents.serverless.service.provider
          .compiledCloudFormationTemplate.Resources;
        expect(resources[awsCompileApigEvents.apiGatewayDeploymentLogicalId]).to.deep.equal({
          Properties: {},
        });

        expect(resources[stageLogicalId]).to.deep.equal({
          Type: 'AWS::ApiGateway::Stage',
          Properties: {
            RestApiId: {
              Ref: awsCompileApigEvents.apiGatewayRestApiLogicalId,
            },
            DeploymentId: {
              Ref: awsCompileApigEvents.apiGatewayDeploymentLogicalId,
            },
            StageName: stage,
            TracingEnabled: false,
            Tags: [
              { Key: 'foo', Value: '1' },
            ],
          },
        });
      });
    });

    it('should override provider.stackTags by provider.tags', () => {
      awsCompileApigEvents.serverless.service.provider.stackTags = {
        foo: 'from-stackTags',
        bar: 'from-stackTags',
      };
      awsCompileApigEvents.serverless.service.provider.tags = {
        foo: 'from-tags',
        buz: 'from-tags',
      };

      awsCompileApigEvents.compileStage().then(() => {
        const resources = awsCompileApigEvents.serverless.service.provider
          .compiledCloudFormationTemplate.Resources;

        expect(resources[stageLogicalId]).to.deep.equal({
          Type: 'AWS::ApiGateway::Stage',
          Properties: {
            RestApiId: {
              Ref: awsCompileApigEvents.apiGatewayRestApiLogicalId,
            },
            DeploymentId: {
              Ref: awsCompileApigEvents.apiGatewayDeploymentLogicalId,
            },
            StageName: stage,
            TracingEnabled: false,
            Tags: [
              { Key: 'foo', Value: 'from-tags' },
              { Key: 'bar', Value: 'from-stackTags' },
              { Key: 'buz', Value: 'from-tags' },
            ],
          },
        });
      });
    });
  });

  describe('logs', () => {
    beforeEach(() => {
      // setting up API Gateway logs
      awsCompileApigEvents.serverless.service.provider.apiGateway = {
        logs: true,
      };
    });

    it('should create a dedicated stage resource if logs are configured', () =>
      awsCompileApigEvents.compileStage().then(() => {
        const resources = awsCompileApigEvents.serverless.service.provider
          .compiledCloudFormationTemplate.Resources;

        expect(resources[stageLogicalId]).to.deep.equal({
          Type: 'AWS::ApiGateway::Stage',
          Properties: {
            RestApiId: {
              Ref: awsCompileApigEvents.apiGatewayRestApiLogicalId,
            },
            DeploymentId: {
              Ref: awsCompileApigEvents.apiGatewayDeploymentLogicalId,
            },
            StageName: 'dev',
            Tags: [],
            TracingEnabled: false,
            MethodSettings: [
              {
                DataTraceEnabled: true,
                HttpMethod: '*',
                LoggingLevel: 'INFO',
                ResourcePath: '/*',
              },
            ],
            AccessLogSetting: {
              DestinationArn: {
                'Fn::GetAtt': [
                  logGroupLogicalId,
                  'Arn',
                ],
              },
              // eslint-disable-next-line
              Format: 'requestId: $context.requestId, ip: $context.identity.sourceIp, caller: $context.identity.caller, user: $context.identity.user, requestTime: $context.requestTime, httpMethod: $context.httpMethod, resourcePath: $context.resourcePath, status: $context.status, protocol: $context.protocol, responseLength: $context.responseLength',
            },
          },
        });

        expect(resources[awsCompileApigEvents.apiGatewayDeploymentLogicalId]).to.deep.equal({
          Properties: {},
        });
      }));

    it('should create a Log Group resource', () =>
      awsCompileApigEvents.compileStage().then(() => {
        const resources = awsCompileApigEvents.serverless.service.provider
          .compiledCloudFormationTemplate.Resources;

        expect(resources[logGroupLogicalId]).to.deep.equal({
          Type: 'AWS::Logs::LogGroup',
          Properties: {
            LogGroupName: '/aws/api-gateway/my-service-dev',
          },
        });
      }));

    it('should create a IAM Role resource', () =>
      awsCompileApigEvents.compileStage().then(() => {
        const resources = awsCompileApigEvents.serverless.service.provider
          .compiledCloudFormationTemplate.Resources;

        expect(resources[logsRoleLogicalId]).to.deep.equal({
          Type: 'AWS::IAM::Role',
          Properties: {
            AssumeRolePolicyDocument: {
              Statement: [
                {
                  Action: [
                    'sts:AssumeRole',
                  ],
                  Effect: 'Allow',
                  Principal: {
                    Service: [
                      'apigateway.amazonaws.com',
                    ],
                  },
                },
              ],
              Version: '2012-10-17',
            },
            ManagedPolicyArns: [
              'arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs',
            ],
            Path: '/',
            RoleName: {
              'Fn::Join': [
                '-',
                [
                  'my-service',
                  'dev',
                  {
                    Ref: 'AWS::Region',
                  },
                  'apiGatewayLogsRole',
                ],
              ],
            },
          },
        });
      }));

    it('should create an Account resource', () =>
      awsCompileApigEvents.compileStage().then(() => {
        const resources = awsCompileApigEvents.serverless.service.provider
          .compiledCloudFormationTemplate.Resources;

        expect(resources[accountLogicalid]).to.deep.equal({
          Type: 'AWS::ApiGateway::Account',
          Properties: {
            CloudWatchRoleArn: {
              'Fn::GetAtt': [
                logsRoleLogicalId,
                'Arn',
              ],
            },
          },
        });
      }));
  });
});
