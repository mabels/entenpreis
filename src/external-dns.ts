import route53 = require('@aws-cdk/aws-route53');
import cdk = require('@aws-cdk/core');
import eks = require('@aws-cdk/aws-eks');
import iam = require('@aws-cdk/aws-iam');
import { EKSResult } from './eks-stack';
import { PolicyStatement } from '@aws-cdk/aws-iam';

export interface ExternalDNSProps {
  readonly externalDnsNamespace?: string; // default external
  readonly externalDnsImage?: string; // default registry.opensource.zalan.do/teapot/external-dns:latest
  readonly zones: route53.PublicHostedZone[];
}

export function externalDNS(eksr: EKSResult, props: ExternalDNSProps) {
  const toolsNS = props.externalDnsNamespace || 'kuber';

  const dnsAdmin = eksr.eks.addServiceAccount(`SA-${eksr.props.baseName}-${toolsNS}-externaldns`, {
    name: `${toolsNS}-externaldns`,
    namespace: toolsNS,
  });

  dnsAdmin.addToPolicy(
    new PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['route53:ChangeResourceRecordSets'],
      resources: ['arn:aws:route53:::hostedzone/*'],
    }),
  );
  dnsAdmin.addToPolicy(
    new PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['route53:ListHostedZones', 'route53:ListResourceRecordSets'],
      resources: ['*'],
    }),
  );
  eksr.eks
    .addManifest(`CBR-${eksr.props.baseName}-${toolsNS}-viewer`, {
      apiVersion: 'rbac.authorization.k8s.io/v1beta1',
      kind: 'ClusterRoleBinding',
      metadata: {
        name: `${toolsNS}-externaldns-viewer`,
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: dnsAdmin.serviceAccountName,
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: dnsAdmin.serviceAccountName,
          namespace: dnsAdmin.serviceAccountNamespace,
        },
      ],
    })
    .node.addDependency(dnsAdmin);

  eksr.eks.addManifest(`CR-${eksr.props.baseName}-${toolsNS}-viewer`, {
    apiVersion: 'rbac.authorization.k8s.io/v1beta1',
    kind: 'ClusterRole',
    metadata: { name: `${toolsNS}-externaldns-viewer` },
    rules: [
      {
        apiGroups: [''],
        resources: ['services', 'endpoints', 'pods'],
        verbs: ['get', 'watch', 'list'],
      },
      {
        apiGroups: ['extensions', 'networking.k8s.io'],
        resources: ['ingresses'],
        verbs: ['get', 'watch', 'list'],
      },
      {
        apiGroups: [''],
        resources: ['nodes'],
        verbs: ['list', 'watch'],
      },
    ],
  });

  const externalDnsImage =
    props.externalDnsImage || 'registry.opensource.zalan.do/teapot/external-dns:latest';
  eksr.eks
    .addManifest(`Deployment-${eksr.props.baseName}-${toolsNS}-externaldns`, {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `${toolsNS}-externaldns`,
        namespace: dnsAdmin.serviceAccountNamespace,
      },
      spec: {
        strategy: { type: 'Recreate' },
        selector: {
          matchLabels: {
            app: `${toolsNS}-externaldns`,
          },
        },
        template: {
          metadata: {
            labels: {
              app: `${toolsNS}-externaldns`,
            },
          },
          spec: {
            serviceAccount: dnsAdmin.serviceAccountName,
            containers: props.zones.map((zone) => ({
              name: `edns-${zone.zoneName.replace(/\./g, '-')}`,
              image: externalDnsImage,
              args: [
                '--source=service',
                '--source=ingress',
                `--domain-filter=${zone.zoneName}`,
                '--provider=aws',
                '--policy=upsert-only',
                '--aws-zone-type=public',
                '--registry=txt',
                `--txt-owner-id=${zone.hostedZoneId}`,
              ],
            })),
            securityContext: {
              fsGroup: 65534,
            },
          },
        },
      },
    })
    .node.addDependency(dnsAdmin);
}
