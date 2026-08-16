import 'uno.css';
import '/@/design/index.less';
import 'ant-design-vue/dist/reset.css';
// 注册图标
import 'virtual:svg-icons-register';
import App from './App.vue';
import { createApp } from 'vue';
import { initAppConfigStore } from '/@/logics/initAppConfig';
import { setupErrorHandle } from '/@/logics/error-handle';
import { router, createRouter, setupRouter } from '/@/router';
import { setupRouterGuard } from '/@/router/guard';
import { setupStore } from '/@/store';
import { setupGlobDirectives } from '/@/directives';
import { setupI18n } from '/@/locales/setupI18n';
import { registerGlobComp } from '/@/components/registerGlobComp';
import { registerThirdComp } from '/@/settings/registerThirdComp';
import { setupAutocompleteOff } from '/@/utils/autocompleteOff';

// 注册online模块lib
import { registerPackages } from '/@/utils/monorepo/registerPackages';

// 程序入口
async function main() {
  await bootstrap();
}

main();

async function bootstrap() {
  // 创建应用实例
  const app = createApp(App);
  // 【QQYUN-6329】
  window['JAppRootInstance'] = app;

  // 创建路由
  createRouter();

  // 配置存储
  setupStore(app);

  // 多语言配置,异步情况:语言文件可以从服务器端获得
  await setupI18n(app);

  // 初始化内部系统配置
  initAppConfigStore();

  // 注册外部模块路由(注册online模块lib)
  registerPackages(app);

  // 注册全局组件
  registerGlobComp(app);

  // 配置路由
  setupRouter(app);

  // 路由保护
  setupRouterGuard(router);

  // 注册全局指令
  setupGlobDirectives(app);

  // 配置全局错误处理
  setupErrorHandle(app);

  // 注册第三方组件
  await registerThirdComp(app);

  // 当路由准备好时再执行挂载( https://next.router.vuejs.org/api/#isready)
  await router.isReady();

  // 挂载应用
  app.mount('#app', true);

  // 全局禁用输入框浏览器自动填充下拉(autocomplete="off")，含动态渲染的弹窗/抽屉/表格
  setupAutocompleteOff(document.body);

  return app
}
