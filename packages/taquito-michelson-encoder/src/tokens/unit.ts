import { Token, TokenFactory } from './token';

export class UnitToken extends Token {
  static prim = 'unit';

  constructor(
    protected val: { prim: string; args: any[]; annots: any[] },
    protected idx: number,
    protected fac: TokenFactory
  ) {
    super(val, idx, fac);
  }

  public Encode(args: any[]): any {
    args.pop();
    return { prim: 'Unit' };
  }

  public EncodeObject(_val: any): any {
    return { prim: 'Unit' };
  }

  public Execute(): { [key: string]: any } {
    return null as any;
  }

  public ExtractSchema() {
    return UnitToken.prim;
  }
}
