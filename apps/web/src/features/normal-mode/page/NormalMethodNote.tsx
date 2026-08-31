export function NormalMethodNote() {
  return (
    <div className="method-note">
      <span>
        {"SINGLE MODE FIELD"}
      </span>
      <p>
        {"单模态声场使用 Kraken 返回的复水平波数与本征函数，按点声源公式 pₘ(z,r)=φₘ(z)·i√(2π)e^(iπ/4)φₘ(zₛ)e^(−ikₘr)/√(kₘr) 直接合成，并显示未经归一化的 TLₘ=−20log₁₀|pₘ|。切换模态不会重新启动求解器。"}
      </p>
    </div>
  );
}
