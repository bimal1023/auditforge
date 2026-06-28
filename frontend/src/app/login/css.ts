/**
 * Responsive layout + keyframes for the login page.
 * Injected via dangerouslySetInnerHTML in page.tsx so the @media rules
 * actually scope on the inline-styled elements via classNames below.
 */
export const CSS = `
.lp-login {
  width: 100%; min-height: 100vh; display: grid;
  grid-template-columns: 1.15fr 1fr;
  font-family: 'Inter', system-ui, sans-serif;
}
.lp-login-left {
  position: relative; overflow: hidden;
  background: linear-gradient(150deg, #040A14 0%, #081828 40%, #0F2440 72%, #16345C 100%);
  color: #fff;
  display: flex; flex-direction: column;
  padding: 44px 60px;
  min-height: 100vh;
}
.lp-login-right {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  padding: 40px 48px;
  background: #fff;
  overflow-y: auto;
  min-height: 100vh;
}
.lp-login-h1 { font-size: 52px; line-height: 1.02; }
.lp-login-back { position: absolute; top: 28px; right: 36px; }
.lp-login-form-wrap { width: 100%; max-width: 380px; }

@media (max-width: 1024px) {
  .lp-login { grid-template-columns: 1fr 1fr; }
  .lp-login-left { padding: 36px 40px; }
  .lp-login-right { padding: 32px 36px; }
  .lp-login-h1 { font-size: 40px; }
}
@media (max-width: 880px) {
  .lp-login { grid-template-columns: 1fr; }
  .lp-login-left { display: none; }
  .lp-login-right { padding: 24px 20px 40px; }
  .lp-login-back { top: 16px; right: 16px; padding: 6px 10px !important; font-size: 12px !important; }
  .lp-login-form-wrap { max-width: 420px; padding-top: 32px; }
}
@media (max-width: 480px) {
  .lp-login-right { padding: 16px 16px 32px; }
}

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes af-pulse {
  0%,100% { opacity: 1; }
  50%     { opacity: 0.4; }
}
`;
