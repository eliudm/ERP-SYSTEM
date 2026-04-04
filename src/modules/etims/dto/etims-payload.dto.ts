export interface EtimsItem {
  itemSeq: number;
  itemCd: string;
  itemClsCd: string;
  itemNm: string;
  qty: number;
  prc: number;
  splyAmt: number;
  dcRt: number;
  dcAmt: number;
  taxblAmt: number;
  taxTyCd: string;
  taxAmt: number;
  totAmt: number;
}

export interface EtimsPayload {
  invcNo: string;
  orgInvcNo?: string;
  cfmDt: string;
  pmtTyCd: string;
  rcptTyCd: string;
  salesTyCd: string;
  custTpin?: string;
  custNm?: string;
  salesSttsCd: string;
  stockRlsDt?: string;
  totItemCnt: number;
  taxblAmtA: number;
  taxblAmtB: number;
  taxblAmtC: number;
  taxblAmtD: number;
  taxRtA: number;
  taxRtB: number;
  taxRtC: number;
  taxRtD: number;
  taxAmtA: number;
  taxAmtB: number;
  taxAmtC: number;
  taxAmtD: number;
  totTaxblAmt: number;
  totTaxAmt: number;
  totAmt: number;
  itemList: EtimsItem[];
}
