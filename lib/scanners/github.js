/**
 * GitHub Personal Access Token Scanner
 * Requires @octokit/rest (optional dependency)
 */

let Octokit;

try {
  const octokitModule = await import('@octokit/rest');
  Octokit = octokitModule.Octokit;
} catch (error) {
  // Octokit not installed - graceful degradation
}

/**
 * Check if GitHub scanning is available
 */
export function isAvailable() {
  return !!Octokit;
}

/**
 * Scan GitHub for Personal Access Tokens
 */
export async function scanGitHubTokens() {
  if (!isAvailable()) {
    throw new Error(
      'Octokit not installed. Install with: npm install @octokit/rest'
    );
  }

  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    throw new Error(
      'GITHUB_TOKEN environment variable not set. Export your token to scan GitHub PATs.'
    );
  }

  try {
    const octokit = new Octokit({ auth: token });
    
    // Get the authenticated user to verify token works
    const { data: user } = await octokit.rest.users.getAuthenticated();
    
    // Note: GitHub API doesn't provide a direct way to list all PATs
    // We can only get info about the current token being used
    // For a real implementation, you'd need GitHub Apps API or Enterprise Server API
    
    // For now, we'll just return info about the current token
    const tokenInfo = {
      name: `github-pat-${user.login}`,
      provider: 'github',
      type: 'personal_access_token',
      username: user.login,
      scopes: 'Current token (scopes not accessible via API)',
      // GitHub doesn't expose token creation or expiry via API for security
      // Users will need to track this manually
      note: 'Token verification successful. Manually add expiry date if known.'
    };

    return [tokenInfo];
  } catch (error) {
    if (error.status === 401) {
      throw new Error('GitHub token is invalid or expired');
    }
    throw new Error(`GitHub scan failed: ${error.message}`);
  }
}

/**
 * Convert scanned tokens to secret format for tracking
 */
export function convertToSecrets(tokens) {
  return tokens.map(token => ({
    name: token.name,
    provider: 'github',
    type: 'personal_access_token',
    createdAt: new Date().toISOString().split('T')[0],
    expiresAt: null, // Must be set manually
    lastRotated: new Date().toISOString().split('T')[0],
    rotationPolicy: 90,
    notes: token.note || `GitHub PAT for ${token.username}`
  }));
}
