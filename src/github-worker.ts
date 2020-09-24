import eks = require("@aws-cdk/aws-eks");
import route53 = require("@aws-cdk/aws-route53");

export interface GithubWorkerProps {
  readonly replicaCount?: number;
  readonly labels?: string[];
  readonly url: string;
  readonly token: string;
  readonly image: string;
  readonly command?: string[];
}

export function githubWorker(
  eksCluster: eks.Cluster,
  zones: route53.PublicHostedZone[],
  serviceAccount: eks.ServiceAccount,
  props: GithubWorkerProps
) {
  const url = new URL(props.url);
  const workerName = `${eksCluster.clusterName}-${url.port.replace(
    /[\/\.]+/,
    "-"
  )}`;
  eksCluster.addManifest(`Deployment-${workerName}`, {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: workerName,
      namespace: serviceAccount.serviceAccountNamespace,
      labels: {
        "app.kubernetes.io/name": workerName,
      },
    },
    spec: {
      replicas: props.replicaCount || 1,
      strategy: {
        type: "RollingUpdate",
      },
      selector: {
        matchLabels: {
          "app.kubernetes.io/name": workerName,
          "app.kubernetes.io/instance": workerName,
        },
      },
      template: {
        metadata: {
          annotations: {},
          labels: {
            "app.kubernetes.io/name": workerName,
            "app.kubernetes.io/instance": workerName,
          },
        },
        spec: {
          serviceAccountName: serviceAccount.serviceAccountName,
          securityContext: {
            fsGroup: 27,
          },
          containers: [
            {
              name: "dind",
              image: "docker:dind",
              securityContext: {
                privileged: true,
              },
              command: [
                "/usr/local/bin/dockerd",
                "--host=unix:///var/run/docker.sock",
                "--host=tcp://0.0.0.0:2376",
              ],
            },
            {
              name: "worker",
              image: props.image,
              command: props.command || ["/usr/local/bin/worker.sh"],
              imagePullPolicy: "Always",
              env: [
                {
                  name: "GITHUB_ACCESS_TOKEN",
                  value: props.token,
                },
                {
                  name: "RUNNER_REPOSITORY_URL",
                  value: props.url,
                },
                {
                  name: "RUNNER_LABELS",
                  value: [
                    ...(props.labels || []),
                    eksCluster.clusterName,
                    ...zones.map((i) => i.zoneName),
                  ].join(","),
                },
                {
                  name: "DOCKER_HOST",
                  value: "tcp://127.0.0.1:2376",
                },
              ],
              resources: {},
              volumeMounts: [],
            },
          ],
          nodeSelector: {},
          affinity: {},
          tolerations: [],
        },
      },
    },
  });
}
