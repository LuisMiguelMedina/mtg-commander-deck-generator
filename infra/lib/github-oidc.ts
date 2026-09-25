import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export type GitHubOidcDeployRoleProps = {
  /** e.g. LuisMiguelMedina */
  owner: string;
  /** e.g. mtg-commander-deck-generator */
  repo: string;
  /** Human-readable role description */
  description: string;
  /** Managed + inline policies for this deploy role */
  policy: iam.PolicyDocument;
};

/**
 * IAM role assumable by GitHub Actions (OIDC) for this repository.
 * Reuses the account's existing token.actions.githubusercontent.com provider when present.
 */
export function addGitHubOidcDeployRole(
  scope: Construct,
  id: string,
  props: GitHubOidcDeployRoleProps,
): iam.Role {
  const providerArn = `arn:aws:iam::${cdk.Stack.of(scope).account}:oidc-provider/token.actions.githubusercontent.com`;

  const role = new iam.Role(scope, id, {
    assumedBy: new iam.FederatedPrincipal(
      providerArn,
      {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': `repo:${props.owner}/${props.repo}:*`,
        },
      },
      'sts:AssumeRoleWithWebIdentity',
    ),
    description: props.description,
    inlinePolicies: {
      DeployPolicy: props.policy,
    },
    maxSessionDuration: cdk.Duration.hours(1),
  });

  return role;
}
