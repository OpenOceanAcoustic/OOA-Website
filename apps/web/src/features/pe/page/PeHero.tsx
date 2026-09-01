import type { UsePePageResult } from "../hooks/usePePage";

export function PeHero({ page }: { readonly page: UsePePageResult }) {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">
          {"OPENOCEAN FIELD · PARABOLIC EQUATION"}
        </p>
        <h1>
          {"观察 Padé 阶数如何改变"}
          <em>
            {"前向声场。"}
          </em>
        </h1>
        <p className="lead">
          {"固定环境和步长，仅改变 nPade 项数。对比当前声场与高阶参考场，查看误差随距离累积的位置、收敛趋势以及选定距离上的垂向剖面。"}
        </p>
      </div>
      <aside className="hero-meta" aria-label="运行信息">
        <div>
          <span>
            {"ENGINE"}
          </span>
          <strong id="heroEngine">{page.runtimeView.engine}</strong>
        </div>
        <div>
          <span>
            {"MODEL"}
          </span>
          <strong id="heroModel">{page.parameters.model.toUpperCase()}</strong>
        </div>
        <div>
          <span>
            {"REFERENCE"}
          </span>
          <strong>
            {"nPade = 10"}
          </strong>
        </div>
      </aside>
    </section>
  );
}
