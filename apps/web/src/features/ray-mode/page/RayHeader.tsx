export function RayHeader() {
  return (
    <header className="topbar">
      <a className="brand" href="#top" aria-label="OOA-RayMode 首页">
        <span className="brand-mark" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
        <span>
          <strong>
            {"OOA-RayMode"}
          </strong>
          <small>
            {"ACOUSTIC PROPAGATION LAB"}
          </small>
        </span>
      </a>
      <nav aria-label="主导航">
        <a className="active" href="/">
          {"Ray Mode"}
        </a>
        <a href="/normal-mode/">
          {"Normal Mode"}
        </a>
        <a href="/pe/">
          {"PE"}
        </a>
      </nav>
      <div className="status">
        <span></span>
        {" OOB LAB "}
        <b>
          {"READY"}
        </b>
      </div>
    </header>
  );
}
