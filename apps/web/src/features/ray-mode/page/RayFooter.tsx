export function RayFooter() {
  return (
    <footer>
      <div className="brand footer-brand">
        <span className="brand-mark">
          <i></i>
          <i></i>
          <i></i>
        </span>
        <span>
          <strong>
            {"OOA-RayMode"}
          </strong>
          <small>
            {"FIELD RAY MODE · 2D"}
          </small>
        </span>
      </div>
      <p>
        {"交互结果用于原理演示；工程计算请使用 OOB 原生求解器及经验证的环境数据。"}
      </p>
      <a href="#top">
        {"BACK TO TOP ↑"}
      </a>
    </footer>
  );
}
