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

// PlaceSearch: POI 搜索; Geocoder: 逆地理编码; Geolocation: 当前设备定位
const REQUIRED_AMAP_PLUGINS = ['AMap.PlaceSearch', 'AMap.Geocoder', 'AMap.Geolocation'];
const A_MAP_URL = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=${REQUIRED_AMAP_PLUGINS.join(',')}`;
const AMAP_LOAD_TIMEOUT = 15_000;
const LOCATION_TIMEOUT = 10_000;

export const DEFAULT_AMAP_LOCATION = {
  lng: 116.397428,
  lat: 39.90923,
  address: '北京市东城区天安门',
};

export interface CurrentAmapLocation {
  lng: number;
  lat: number;
  address: string;
}

let amapPromise: Promise<any> | null = null;
let currentLocationPromise: Promise<CurrentAmapLocation> | null = null;
let currentLocationCache: { value: CurrentAmapLocation; expiresAt: number } | null = null;

function configureSecurityCode() {
  if (!AMAP_SECURITY_CODE) return;
  (window as any)._AMapSecurityConfig = {
    ...(window as any)._AMapSecurityConfig,
    securityJsCode: AMAP_SECURITY_CODE,
  };
}

function hasRequiredPlugins(AMap: any) {
  return !!AMap?.PlaceSearch && !!AMap?.Geocoder && !!AMap?.Geolocation;
}

function ensureRequiredPlugins(AMap: any): Promise<any> {
  if (hasRequiredPlugins(AMap)) return Promise.resolve(AMap);
  if (typeof AMap?.plugin !== 'function') return Promise.reject(new Error('AMap plugin loader unavailable'));

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('AMap plugin load timeout')), AMAP_LOAD_TIMEOUT);
    AMap.plugin(REQUIRED_AMAP_PLUGINS, () => {
      window.clearTimeout(timer);
      if (hasRequiredPlugins(AMap)) resolve(AMap);
      else reject(new Error('AMap required plugins load failed'));
    });
  });
}

/**
 * 加载高德 JS API(单例), 返回 window.AMap; 失败 reject
 */
export function loadAMap(): Promise<any> {
  configureSecurityCode();
  if (amapPromise) return amapPromise;

  const existingAMap = (window as any).AMap;
  if (existingAMap) {
    amapPromise = ensureRequiredPlugins(existingAMap).catch((error) => {
      amapPromise = null;
      throw error;
    });
    return amapPromise;
  }

  amapPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => {
      script.remove();
      reject(new Error('AMap script load timeout'));
    }, AMAP_LOAD_TIMEOUT);

    const cleanup = () => {
      window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
    };

    script.type = 'text/javascript';
    script.src = A_MAP_URL;
    script.onload = () => {
      cleanup();
      ensureRequiredPlugins((window as any).AMap)
        .then(resolve)
        .catch(reject);
    };
    script.onerror = (error) => {
      cleanup();
      reject(error);
    };
    document.head.appendChild(script);
  }).catch((error) => {
    amapPromise = null;
    throw error;
  });
  return amapPromise;
}

function cloneLocation(value: CurrentAmapLocation): CurrentAmapLocation {
  return { ...value };
}

/**
 * 获取当前设备位置。定位结果短暂缓存 60 秒以合并短时间内的重复请求，
 * 不缓存用户在业务表单中手动选择的位置。
 */
export async function getCurrentAMapLocation(): Promise<CurrentAmapLocation> {
  const now = Date.now();
  if (currentLocationCache && currentLocationCache.expiresAt > now) return cloneLocation(currentLocationCache.value);
  if (currentLocationPromise) return currentLocationPromise.then(cloneLocation);

  currentLocationPromise = loadAMap()
    .then(
      (AMap) =>
        new Promise<CurrentAmapLocation>((resolve, reject) => {
          if (!AMap.Geolocation) {
            reject(new Error('AMap Geolocation plugin load failed'));
            return;
          }

          let settled = false;
          const finish = (callback: () => void) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            callback();
          };
          const timer = window.setTimeout(() => finish(() => reject(new Error('定位超时'))), LOCATION_TIMEOUT);
          const geolocation = new AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 8000,
            convert: true,
            needAddress: true,
            extensions: 'all',
          });

          geolocation.getCurrentPosition((status: string, result: any) => {
            try {
              const position = result?.position;
              const rawLng = position?.getLng?.() ?? position?.lng;
              const rawLat = position?.getLat?.() ?? position?.lat;
              const lng = rawLng === '' || rawLng == null ? NaN : Number(rawLng);
              const lat = rawLat === '' || rawLat == null ? NaN : Number(rawLat);
              const valid = Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
              if (status !== 'complete' || !valid) {
                finish(() => reject(new Error(result?.message || result?.info || '定位失败')));
                return;
              }
              const value = {
                lng,
                lat,
                address: result?.formattedAddress || '',
              };
              finish(() => {
                currentLocationCache = { value: cloneLocation(value), expiresAt: Date.now() + 60_000 };
                resolve(cloneLocation(value));
              });
            } catch (error) {
              finish(() => reject(error));
            }
          });
        })
    )
    .finally(() => {
      currentLocationPromise = null;
    });

  return currentLocationPromise.then(cloneLocation);
}
