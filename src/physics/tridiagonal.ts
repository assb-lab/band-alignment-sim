/** Thomas algorithm for tridiagonal system. a=sub, b=diag, c=super, d=rhs */
export function solveTridiagonal(
  a: Float64Array,
  b: Float64Array,
  c: Float64Array,
  d: Float64Array,
): Float64Array {
  const n = b.length;
  const cp = new Float64Array(n);
  const dp = new Float64Array(n);
  const x = new Float64Array(n);

  cp[0] = c[0]! / b[0]!;
  dp[0] = d[0]! / b[0]!;

  for (let i = 1; i < n; i++) {
    const denom = b[i]! - a[i]! * cp[i - 1]!;
    cp[i] = i < n - 1 ? c[i]! / denom : 0;
    dp[i] = (d[i]! - a[i]! * dp[i - 1]!) / denom;
  }

  x[n - 1] = dp[n - 1]!;
  for (let i = n - 2; i >= 0; i--) {
    x[i] = dp[i]! - cp[i]! * x[i + 1]!;
  }
  return x;
}

/** Bernoulli function B(x) = x / (exp(x) - 1), stable for small x */
export function bernoulli(x: number): number {
  if (Math.abs(x) < 1e-4) {
    return 1 - x / 2 + (x * x) / 12;
  }
  const ex = Math.exp(x);
  if (!Number.isFinite(ex)) return 0;
  return x / (ex - 1);
}
