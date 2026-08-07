import type { GlobConfig } from '/#/config';

import { getAppEnvConfig } from '/@/utils/env';

export const useGlobSetting = (): Readonly<GlobConfig> => {
  const {
    VITE_GLOB_APP_TITLE,
    VITE_GLOB_API_URL,
    VITE_GLOB_APP_SHORT_NAME,
    VITE_GLOB_API_URL_PREFIX,
    VITE_GLOB_DOMAIN_URL,
    VITE_GLOB_ONLINE_VIEW_URL,
    VITE_GLOB_RUN_PLATFORM,
  } = getAppEnvConfig();

  // 短标题：替换shortName的下划线为空格
  const shortTitle = VITE_GLOB_APP_SHORT_NAME.replace(/_/g, " ");
  // Take global configuration
  const glob: Readonly<GlobConfig> = {
    title: VITE_GLOB_APP_TITLE,
    domainUrl: VITE_GLOB_DOMAIN_URL,
    apiUrl: VITE_GLOB_API_URL,
    shortName: VITE_GLOB_APP_SHORT_NAME,
    shortTitle: shortTitle,
    urlPrefix: VITE_GLOB_API_URL_PREFIX,
    uploadUrl: VITE_GLOB_DOMAIN_URL,
    viewUrl: VITE_GLOB_ONLINE_VIEW_URL,
    // true: 新任务办理页面弹窗, false:旧的任务办理页面弹窗
    useNewTaskModal: true,
    // 当前是否运行在 electron 平台
    isElectronPlatform: VITE_GLOB_RUN_PLATFORM === 'electron',
  };

  if (!window['_CONFIG']) {
    window['_CONFIG'] = {}
  }

  // 代码逻辑说明: 【QQYUN-10956】配置了自定义前缀，外部连接打不开，需要兼容处理
  let domainURL = VITE_GLOB_DOMAIN_URL;

  // 如果不是以http(s)开头的，也不是以域名开头的，那么就是拼接当前域名
  if (!/^http(s)?/.test(domainURL) && !/^(\/\/)?(.*\.)?.+\..+/.test(domainURL)) {
    if (!domainURL.startsWith('/')) {
      domainURL = '/' + domainURL;
    }
    domainURL = window.location.origin + domainURL;
  }

  // @ts-ignore
  window._CONFIG['domianURL'] = domainURL;

  return glob as Readonly<GlobConfig>;
};
