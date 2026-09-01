import type { CSSProperties } from "react";

export function PeProfile() {
  return (
    <section className="panel profile-panel">
      <div className="panel-head">
        <div>
          <p className="micro">
            {"VERTICAL TL PROFILE"}
          </p>
          <h3 id="profileTitle">
            {"18.0 km 垂向剖面"}
          </h3>
        </div>
        <div className="plot-legend">
          <span>
            <i style={{ "--legend": "#62d8e7" } as CSSProperties}></i>
            {"当前"}
          </span>
          <span>
            <i style={{ "--legend": "#c5f16b" } as CSSProperties}></i>
            {"nPade=10"}
          </span>
        </div>
      </div>
      <div className="plot-wrap auxiliary-wrap">
        <canvas id="profileCanvas" aria-label="当前场和高阶参考场的垂向传播损失剖面"></canvas>
        <span className="plot-note">
          {"DEPTH PROFILE"}
        </span>
      </div>
    </section>
  );
}
