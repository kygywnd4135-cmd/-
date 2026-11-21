type Props={kind:'points'|'primacy';amount:number;className?:string};

export default function CityCurrencyBalance({kind,amount,className=''}:Props){
  const label=kind==='points'?'보유 포인트':'보유 프리머시 토큰';
  const value=amount.toLocaleString('ko-KR');
  return <div className={`currency-balance currency-${kind} ${className}`} aria-label={`${label} ${value}`}>
    <span className="currency-copy"><span className="currency-label">{label} : </span><strong className="currency-amount">{value}</strong></span>
    <img className="currency-logo" src={`/assets/currency/${kind}.svg`} alt="" aria-hidden="true" draggable={false}/>
  </div>;
}
