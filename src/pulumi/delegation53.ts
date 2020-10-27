// import * as k8sx from "@pulumi/kubernetesx";
import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import { ProviderResource } from '@pulumi/pulumi';
import { buildServiceAccountRole } from './build-service-account-role';
import { buildAffinity } from './build-affinity';

export interface Delegation53Props {
  readonly delegationDnsNamespace?: string;
  readonly delegation53Image?: string;
  readonly zones: aws.route53.Zone[];
  readonly rolesARN: string[];
  readonly accountId: string;
  readonly oidcId: string;
  readonly name?: string;
  readonly provider?: ProviderResource;
  readonly nodeGroup?: string;
}
export async function delegation53(props: Delegation53Props) {
  const toolsNS = props.delegationDnsNamespace || 'kuber';
  const name = props.name || 'delegation53'
  const ns = new k8s.core.v1.Namespace(
    `ns-${toolsNS}-delegation53`,
    {
      metadata: {
        name: toolsNS,
      },
    },
    { provider: props.provider }
  );

  const saName = `SA-${toolsNS}-${name}`;
  const role = await buildServiceAccountRole({
    newRole: {
      name: saName,
      namespace: toolsNS,
      accountId: props.accountId,
      oidcId: props.oidcId,
    },
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: 'Allow',
          Action: ['route53:ChangeResourceRecordSets'],
          Resource: ['arn:aws:route53:::hostedzone/*'],
        },
        {
          Effect: 'Allow',
          Action: ['sts:AssumeRole'],
          Resource: ['*'],
        },
        {
          Effect: 'Allow',
          Action: ['route53:ListHostedZones', 'route53:ListResourceRecordSets'],
          Resource: ['*'],
        }
      ]
    }
  });

  new k8s.apps.v1.Deployment(`Deployment-${toolsNS}-delegation53`, {
    apiVersion: 'apps/v1',
    kind: 'Deployment',

    metadata: {
      name: `${toolsNS}-delegation53`,
      namespace: toolsNS,
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
          ...buildAffinity(props),
          serviceAccount: saName,
          containers: [
            // {
            //   name: `aws-cli`,
            //   image: 'fastandfearless/dev-base-container:latest',
            //   args: ['/bin/sleep', '100000'],
            // },
            {
              name: `aws-delegation53`,
              image: props.delegation53Image || 'fastandfearless/aws-delegation53:latest',
              // args: ['/bin/sleep', '100000'],
              env: [
                {
                  name: 'ZONES',
                  value: props.zones.map((i) => i.name).join(','),
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
  }, { provider: props.provider })
}
