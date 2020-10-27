/*
helm repo add incubator http://storage.googleapis.com/kubernetes-charts-incubator\
helm install incubator/aws-alb-ingress-controller --set autoDiscoverAwsRegion=true --set autoDiscoverAwsVpcID=true --set clusterName=ea
helm install aws-alb-ingress-controller incubator/aws-alb-ingress-controller --set autoDiscoverAwsRegion=true --set autoDiscoverAwsVpcID=true --set clusterName=ea
helm install aws-alb-ingress-controller incubator/aws-alb-ingress-controller --set autoDiscoverAwsRegion=true --set autoDiscoverAwsVpcID=true --set clusterName=ea -n developer
*/
/*
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: alb
    # alb.ingress.kubernetes.io/scheme: internet-facing
  name: total-toll
  namespace: developer
spec:
  rules:
    - host: abelmen-host.ea.fielmann.one
      http:
        paths:
          - path: /*
            backend:
              serviceName: svc-abelmen-host
              servicePort: 9999
*/

import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";
// import * as k8sx from "@pulumi/kubernetesx";
import { Input, ProviderResource } from "@pulumi/pulumi";
import { deserializeProperties } from "@pulumi/pulumi/runtime";
import { buildAffinity } from './build-affinity';

export interface AwsElbControllerProps {
  readonly version?: string;
  readonly namespace?: string;
  readonly provider?: ProviderResource;
  readonly name?: string;
  readonly clusterName: string;
  // readonly vpcs?: aws.[];
  readonly nodeGroup?: string;
}

export async function awsElbController(props: AwsElbControllerProps) {
  const name = props.name || "aws-elb";
  const nsStr = props.namespace || "aws-elb";

  const ns = new k8s.core.v1.Namespace(
    `ns-${nsStr}`,
    {
      metadata: {
        name: nsStr,
      },
    },
    { provider: props.provider }
  );
  const awsElbController = new k8s.helm.v3.Chart(
    name,
    {
      fetchOpts: {
        repo: "http://storage.googleapis.com/kubernetes-charts-incubator"
      },
      // repo: 'stable',
      chart: "aws-alb-ingress-controller",
      // version: props.version || "v1.0.3",
      namespace: nsStr,
      values: {
        autoDiscoverAwsRegion: true,
        autoDiscoverAwsVpcID: true,
        clusterName: props.clusterName,
        ...buildAffinity(props)
      }
    },
    { provider: props.provider, dependsOn: ns }
  );

  return awsElbController;
}
