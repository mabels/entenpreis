import iam = require('@aws-cdk/aws-iam');
import route53 from '@aws-cdk/aws-route53';
import { EKSResult } from './eks-stack';

export interface Delegation53Props {
  readonly delegationDnsNamespace?: string;
  readonly delegation53Image?: string;
  readonly zones: route53.IPublicHostedZone[];
  readonly rolesARN: string[];
}
export function delegation53(eksr: EKSResult, props: Delegation53Props) {
  const toolsNS = props.delegationDnsNamespace || 'kuber';

  const ns = eksr.eks.addManifest(`NS-${eksr.props.baseName}-${toolsNS}-delegation53`, {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: { name: toolsNS },
  });
  const delegation53SA = eksr.eks.addServiceAccount(
    `SA-${eksr.props.baseName}-${toolsNS}-delegation53`,
    {
      name: `${toolsNS}-delegation53`,
      namespace: toolsNS,
    },
  );
  delegation53SA.node.addDependency(ns);

  delegation53SA.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sts:AssumeRole'],
      resources: ['*'],
    }),
  );

  delegation53SA.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['route53:ChangeResourceRecordSets'],
      resources: ['arn:aws:route53:::hostedzone/*'],
    }),
  );
  delegation53SA.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['route53:ListHostedZones', 'route53:ListResourceRecordSets'],
      resources: ['*'],
    }),
  );
  eksr.eks.addManifest(`Deployment-${eksr.props.baseName}-${toolsNS}-delegation53`, {
    apiVersion: 'apps/v1',
    kind: 'Deployment',

    metadata: {
      name: `${toolsNS}-delegation53`,
      namespace: delegation53SA.serviceAccountNamespace,
    },
    spec: {
      strategy: { type: 'Recreate' },
      selector: {
        matchLabels: {
          app: `${toolsNS}-delegation53`,
        },
      },
      template: {
        metadata: {
          labels: {
            app: `${toolsNS}-delegation53`,
          },
        },
        spec: {
          serviceAccount: delegation53SA.serviceAccountName,
          containers: [
            {
              name: `aws-cli`,
              image: 'fastandfearless/dev-base-container:latest',
              args: ['/bin/sleep', '100000'],
            },
            {
              name: `aws-delegation53`,
              image: props.delegation53Image || 'fastandfearless/aws-delegation53',
              args: ['/bin/sleep', '100000'],
              env: [
                {
                  name: 'ZONES',
                  value: props.zones.map((i) => i.zoneName).join(','),
                },
                {
                  name: 'ROLES',
                  value: props.rolesARN.join(","),
                },
              ],
            },
          ],
          securityContext: {
            fsGroup: 65534,
          },
        },
      },
    },
  }).node.addDependency(delegation53SA);
}
