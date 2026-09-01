import type { UseNormalModePageResult } from "../hooks/useNormalModePage";

export function NormalHero({ page }: { readonly page: UseNormalModePageResult }) {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">
          {"OPENOCEAN FIELD · NORMAL MODE"}
        </p>
        <h1>
          {"拆解波导中的每一个"}
          <br />
          <em>
            {"传播模态。"}
          </em>
        </h1>
        <p className="lead">
          {"从水平波数与本征函数出发，观察模态截断如何改变距离—深度声场。点击任意模态，即时查看对应的深度结构与该模态独立形成的声场。"}
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
            {"OUTPUT"}
          </span>
          <strong>
            {"MODES + FIELD"}
          </strong>
        </div>
      </aside>
    </section>
  );
}
