import eks = require("@aws-cdk/aws-eks");
import route53 = require("@aws-cdk/aws-route53");
import { string } from "yargs";
import { EKSResult } from './eks-stack';

export interface Delegation53Props {
  readonly delegationDnsNamespace?: string;
  readonly delegation53Image?: string;
  readonly zones: route53.PublicHostedZone[];
  readonly rolesARN: string[];
}
export function delegation53(
  eksr: EKSResult,
  props: Delegation53Props
) {
  const toolsNS = props.delegationDnsNamespace || "kuber";

  const delegation53SA = eksr.eks.addServiceAccount(
    `Delegation53SA-${eksr.props.baseName}`,
    {
      name: `${toolsNS}-delegation53`,
      namespace: toolsNS,
    }
  );
  eksr.eks.addManifest(`Delegation53-Deployment-${eksr.props.baseName}`, {
    apiVersion: "apps/v1",
    kind: "deployment",
    metadata: {
      name: `Delegation53-${eksr.props.baseName}`,
      namespace: delegation53SA.serviceAccountNamespace,
    },
    spec: {
      strategy: { type: "Recreate" },
      selector: {
        matchLabels: {
          app: `Delegation53-${eksr.props.baseName}`,
        },
      },
      template: {
        metadata: {
          labels: {
            app: `Delegation53-${eksr.props.baseName}`,
          },
        },
        spec: {
          serviceAccount: delegation53SA.serviceAccountName,
          containers: [
            {
              name: `aws-cli`,
              image: "fastandfearless/dev-base-container:latest",
              args: ["/bin/sleep", "100000"],
            },
            {
              name: `aws-delegation53`,
              image:
                props.delegation53Image || "fastandfearless/aws-delegation53",
              env: [
                {
                  name: "ZONES",
                  value: props.zones.map((i) => i.zoneName).join(","),
                },
                {
                  name: "TOPROLEARN",
                  value: props.rolesARN,
                },
              ],
              args: ["/bin/sleep", "100000"],
            },
          ],
          securityContext: {
            fsGroup: 65534,
          },
        },
      },
    },
  });
  //   .node.addDependency(nsExternal);
}
