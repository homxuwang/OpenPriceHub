// Exact rational arithmetic over base-10 inputs. Rounding occurs only at serialization.
// 0..30 total digits, <=12 fractional digits; no Number conversion for arithmetic.
export class D {
  constructor(readonly n: bigint, readonly d: bigint = 1n) {
    if (d <= 0n) throw new Error('Invalid divisor');
  }
  static parse(s: string): D {
    if (typeof s !== 'string' || !/^(0|[1-9]\d*)(\.\d{1,12})?$/.test(s) || s.replace('.', '').length > 30) throw new Error('Invalid decimal');
    const [whole, fraction = ''] = s.split('.');
    return new D(BigInt(whole + fraction), 10n ** BigInt(fraction.length));
  }
  add(b: D) { return new D(this.n * b.d + b.n * this.d, this.d * b.d); }
  sub(b: D) { return new D(this.n * b.d - b.n * this.d, this.d * b.d); }
  mul(b: D) { return new D(this.n * b.n, this.d * b.d); }
  div(b: D) { if (b.n <= 0n) throw new Error('Invalid divisor'); return new D(this.n * b.d, this.d * b.n); }
  cmp(b: D) { const v = this.n * b.d - b.n * this.d; return v < 0n ? -1 : v > 0n ? 1 : 0; }
  ceil() { if (this.n < 0n) throw new Error('Negative ceiling'); return new D((this.n + this.d - 1n) / this.d); }
  text() {
    const scale = 1000000000000n, sign = this.n < 0n ? '-' : '', n = this.n < 0n ? -this.n : this.n;
    const rounded = (n * scale * 2n + this.d) / (2n * this.d);
    return sign + String(rounded / scale) + (rounded % scale ? '.' + String(rounded % scale).padStart(12, '0').replace(/0+$/, '') : '');
  }
}
export const zero = () => D.parse('0');
