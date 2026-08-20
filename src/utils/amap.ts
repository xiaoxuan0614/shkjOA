/**
 * 高德地图(AMap) JS API 单例加载器
 * 数据源: 高德开放平台 Web端(JS API) —— key 需在控制台配置「域名白名单」
 * ⚠️ JS API v2.0 除 key 外还必须配置「安全密钥 securityJsCode」: 在加载脚本前设置
 *    window._AMapSecurityConfig, 否则 PlaceSearch 搜索返回 INVALID_USER_SCODE。
 *    安全密钥在 开放平台 → 应用管理 → Key → Web端(JS API) → 安全密钥 获取,
 *    配置到 .env 的 VITE_AMAP_SECURITY_CODE。
 */

// Web端(JS API) Key(默认内置 key, 可用 .env 的 VITE_AMAP_KEY 覆盖)
export const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || '41ca0077494f68a9b0b65120aeabef0f';

// 安全密钥(与 key 配套, v2.0 必填; 未配置时搜索会报 INVALID_USER_SCODE, 组件兜底提示)
export const AMAP_SECURITY_CODE = import.meta.env.VITE_AMAP_SECURITY_CODE || '';

// PlaceSearch: POI 搜索; Geocoder: 逆地理编码(经纬度→地址, 拖拽地图选点用)
const A_MAP_URL = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.PlaceSearch,AMap.Geocoder`;

let amapPromise: Promise<any> | null = null;

/**
 * 加载高德 JS API(单例), 返回 window.AMap; 失败 reject
 */
export function loadAMap(): Promise<any> {
  if ((window as any).AMap) return Promise.resolve((window as any).AMap);
  if (amapPromise) return amapPromise;
  // v2.0 必须在加载脚本前配置安全密钥, 否则 PlaceSearch 报 INVALID_USER_SCODE
  if (AMAP_SECURITY_CODE) {
    (window as any)._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE };
  }
  amapPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = A_MAP_URL;
    script.onload = () => {
      if ((window as any).AMap?.PlaceSearch) {
        resolve((window as any).AMap);
      } else {
        // 插件未就绪也视为失败
        amapPromise = null;
        reject(new Error('AMap PlaceSearch plugin load failed'));
      }
    };
    script.onerror = (err) => {
      amapPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });
  return amapPromise;
}
