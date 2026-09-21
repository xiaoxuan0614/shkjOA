<template>
  <div class="amap-location-map">
    <div class="amap-location-map__wrap" :style="{ height }">
      <!-- 地图 -->
      <div ref="mapRef" class="amap-location-map__map"></div>

      <!-- 定位 pin(绝对定位覆盖在地图中心, tip 即地图中心点) -->
      <div class="amap-location-map__pin">
        <div class="amap-location-map__pin-pulse"></div>
        <svg class="amap-location-map__pin-svg" width="40" height="52" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="20" cy="49" rx="11" ry="3" fill="rgba(0,0,0,0.18)" />
          <path
            d="M20 2 C 10 2 3 11 3 20 C 3 33 20 50 20 50 C 20 50 37 33 37 20 C 37 11 30 2 20 2 Z"
            fill="#FF4D4F"
            stroke="#CF1322"
            stroke-width="1.5"
          />
          <circle cx="20" cy="20" r="8" fill="#fff" />
          <circle cx="17" cy="17" r="3" fill="#FF7875" opacity="0.65" />
        </svg>
      </div>

      <!-- 顶部搜索 -->
      <div class="amap-location-map__search">
        <AMapPlaceSearch :value="searchKeyword" :disabled="disabled" placeholder="搜索地点，拖动地图可微调定位" @select="onSearchSelect" />
      </div>

      <!-- 加载失败兜底提示 -->
      <div v-if="errorMsg" class="amap-location-map__error">{{ errorMsg }}</div>
    </div>

    <!-- 底部坐标/地址信息条 -->
    <div class="amap-location-map__bar">
      <span class="amap-location-map__bar-item">
        经度：<b>{{ lng != null ? lng.toFixed(6) : '—' }}</b>
      </span>
      <span class="amap-location-map__bar-item">
        纬度：<b>{{ lat != null ? lat.toFixed(6) : '—' }}</b>
      </span>
      <span class="amap-location-map__bar-addr" :title="address">{{ address || '请在地图上选择位置' }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
  import { useDebounceFn } from '@vueuse/core';
  import AMapPlaceSearch, { AmapPoi } from './AMapPlaceSearch.vue';
  import { DEFAULT_AMAP_LOCATION, getCurrentAMapLocation, loadAMap } from '/@/utils/amap';

  const props = withDefaults(
    defineProps<{
      /** 初始经度 */
      lng?: number | null;
      /** 初始纬度 */
      lat?: number | null;
      /** 初始地址(回显) */
      address?: string;
      /** 地图高度(px) */
      height?: string;
      /** 只读 */
      disabled?: boolean;
      /** 无已有坐标时自动定位当前设备，失败则回退天安门 */
      autoLocate?: boolean;
    }>(),
    {
      lng: null,
      lat: null,
      height: '320px',
      autoLocate: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:lng', value: number | null): void;
    (e: 'update:lat', value: number | null): void;
    (e: 'update:address', value: string): void;
    /** 选点结果: name/address/lng/lat; null 表示清空 */
    (e: 'select', poi: AmapPoi | null): void;
  }>();

  const mapRef = ref<HTMLDivElement | null>(null);
  const lng = ref<number | null>(props.lng ?? null);
  const lat = ref<number | null>(props.lat ?? null);
  const address = ref<string>(props.address ?? '');
  const searchKeyword = ref<string>(props.address ?? '');
  const errorMsg = ref('');

  let map: any = null;
  let geocoder: any = null;
  let mapReady = false;
  let isUnmounted = false;
  let suppressedCenterKey = '';
  let geocodeSeq = 0;
  let pendingPoi: AmapPoi | null = null;
  const geocodeCache = new Map<string, string>();

  function coordinateKey(currentLng: number, currentLat: number) {
    return `${currentLng.toFixed(6)},${currentLat.toFixed(6)}`;
  }

  function emitLocation(currentLng: number, currentLat: number, currentAddress: string, currentName = currentAddress) {
    lng.value = currentLng;
    lat.value = currentLat;
    address.value = currentAddress;
    searchKeyword.value = currentAddress;
    emit('update:lng', currentLng);
    emit('update:lat', currentLat);
    emit('update:address', currentAddress);
    emit('select', { name: currentName, address: currentAddress, lng: currentLng, lat: currentLat });
  }

  function clearLocation() {
    geocodeSeq++;
    pendingPoi = null;
    suppressedCenterKey = '';
    lng.value = null;
    lat.value = null;
    address.value = '';
    searchKeyword.value = '';
    emit('update:lng', null);
    emit('update:lat', null);
    emit('update:address', '');
    emit('select', null);
  }

  function reverseGeocode(currentLng: number, currentLat: number) {
    const requestSeq = ++geocodeSeq;
    if (!geocoder) return;
    const key = coordinateKey(currentLng, currentLat);
    const cachedAddress = geocodeCache.get(key);
    if (cachedAddress) {
      emitLocation(currentLng, currentLat, cachedAddress);
      return;
    }
    geocoder.getAddress([currentLng, currentLat], (status: string, result: any) => {
      if (requestSeq !== geocodeSeq || isUnmounted) return;
      if (status === 'complete' && result?.regeocode) {
        const formattedAddress = result.regeocode.formattedAddress || '';
        if (!formattedAddress) return;
        if (geocodeCache.size >= 50) {
          const oldestKey = geocodeCache.keys().next().value;
          if (oldestKey) geocodeCache.delete(oldestKey);
        }
        geocodeCache.set(key, formattedAddress);
        emitLocation(currentLng, currentLat, formattedAddress);
      }
    });
  }

  function handleMapMoveEnd() {
    if (!map || !mapReady || props.disabled) return;
    const center = map.getCenter();
    const currentLng = center.getLng();
    const currentLat = center.getLat();
    const key = coordinateKey(currentLng, currentLat);
    if (suppressedCenterKey === key) {
      suppressedCenterKey = '';
      return;
    }
    suppressedCenterKey = '';
    // 坐标立即回传，地址查询仅作为后续增强，避免逆地理编码失败时丢失用户选点。
    emitLocation(currentLng, currentLat, '');
    reverseGeocode(currentLng, currentLat);
  }

  const onMapMoveEnd = useDebounceFn(handleMapMoveEnd, 250);

  /** 同步外部经纬度(lng/lat 变化时地图飞过去) */
  watch(
    () => [props.lng, props.lat] as const,
    ([nextLng, nextLat]) => {
      const normalizedLng = nextLng ?? null;
      const normalizedLat = nextLat ?? null;
      const changed = normalizedLng !== lng.value || normalizedLat !== lat.value;
      if (changed) {
        geocodeSeq++;
        if (
          pendingPoi &&
          (normalizedLng == null ||
            normalizedLat == null ||
            coordinateKey(normalizedLng, normalizedLat) !== coordinateKey(pendingPoi.lng!, pendingPoi.lat!))
        ) {
          pendingPoi = null;
        }
      }
      lng.value = normalizedLng;
      lat.value = normalizedLat;
      if (map && nextLng != null && nextLat != null) {
        const center = map.getCenter();
        if (Math.abs(center.getLng() - nextLng) > 1e-7 || Math.abs(center.getLat() - nextLat) > 1e-7) {
          suppressedCenterKey = coordinateKey(nextLng, nextLat);
          map.setCenter([nextLng, nextLat], true);
        }
        if (changed && !props.address) reverseGeocode(nextLng, nextLat);
      }
    }
  );

  watch(
    () => props.disabled,
    (disabled) => {
      if (!map) return;
      map.setStatus({
        dragEnable: !disabled,
        zoomEnable: !disabled,
        scrollWheel: !disabled,
        doubleClickZoom: !disabled,
        keyboardEnable: !disabled,
      });
    }
  );

  watch(
    () => props.address,
    (value) => {
      const nextAddress = value ?? '';
      if (nextAddress !== address.value) geocodeSeq++;
      address.value = nextAddress;
      searchKeyword.value = nextAddress;
    }
  );

  /** 搜索选中: 地图飞过去并直接使用 POI 地址，不再重复逆地理编码 */
  function onSearchSelect(poi: AmapPoi | null) {
    if (props.disabled) return;
    if (!poi) {
      clearLocation();
      return;
    }
    if (poi.lng == null || poi.lat == null || !Number.isFinite(poi.lng) || !Number.isFinite(poi.lat)) return;

    geocodeSeq++;
    const selectedAddress = poi.address || poi.name || '';
    const normalizedPoi = { ...poi, address: selectedAddress };
    pendingPoi = map ? null : normalizedPoi;
    if (map) {
      suppressedCenterKey = coordinateKey(poi.lng, poi.lat);
      map.setCenter([poi.lng, poi.lat], true);
    }
    emitLocation(poi.lng, poi.lat, selectedAddress, poi.name || selectedAddress);
  }

  async function initMap() {
    if (!mapRef.value) return;
    let AMap: any;
    try {
      AMap = await loadAMap();
    } catch {
      if (!isUnmounted) errorMsg.value = '地图加载失败，请检查网络或高德 key 配置';
      return;
    }
    if (isUnmounted || !mapRef.value) return;

    let deviceLocation: { lng: number; lat: number; address: string } | null = null;
    const hasCurrentProps = props.lng != null && props.lat != null;
    if (!hasCurrentProps && props.autoLocate) {
      try {
        deviceLocation = await getCurrentAMapLocation();
      } catch {
        // 定位失败仅把地图中心回退到默认位置，不把默认坐标写进业务表单。
      }
    }
    if (isUnmounted || !mapRef.value) return;

    const propLocation =
      props.lng != null && props.lat != null ? { lng: props.lng, lat: props.lat, address: props.address || '', name: props.address || '' } : null;
    const selectedBeforeReady = pendingPoi;
    const initialLocation = selectedBeforeReady || propLocation || deviceLocation;
    const centerLocation = initialLocation || DEFAULT_AMAP_LOCATION;
    const center: [number, number] = [centerLocation.lng!, centerLocation.lat!];

    try {
      map = new AMap.Map(mapRef.value, {
        resizeEnable: true,
        zoom: initialLocation ? 15 : 11,
        center,
        viewMode: '2D',
        showBuildingBlock: true,
      });
      if (props.disabled) {
        map.setStatus({
          dragEnable: false,
          zoomEnable: false,
          scrollWheel: false,
          doubleClickZoom: false,
          keyboardEnable: false,
        });
      }
      geocoder = new AMap.Geocoder({ radius: 1000, extensions: 'base' });
    } catch {
      map?.destroy?.();
      map = null;
      geocoder = null;
      errorMsg.value = '地图初始化失败，请检查高德插件配置';
      return;
    }

    suppressedCenterKey = coordinateKey(center[0], center[1]);
    mapReady = true;
    map.on('moveend', onMapMoveEnd);
    pendingPoi = null;

    if (selectedBeforeReady) {
      // 搜索选点在地图初始化前已向外回传，这里只负责用该点创建地图。
      return;
    }
    if (propLocation) {
      lng.value = propLocation.lng;
      lat.value = propLocation.lat;
      address.value = propLocation.address;
      searchKeyword.value = propLocation.address;
      if (!propLocation.address) reverseGeocode(propLocation.lng, propLocation.lat);
      return;
    }
    if (deviceLocation) {
      emitLocation(deviceLocation.lng, deviceLocation.lat, deviceLocation.address);
      if (!deviceLocation.address) reverseGeocode(deviceLocation.lng, deviceLocation.lat);
    }
  }

  onMounted(initMap);

  onBeforeUnmount(() => {
    isUnmounted = true;
    mapReady = false;
    pendingPoi = null;
    (onMapMoveEnd as any).cancel?.();
    geocodeSeq++;
    if (map) {
      map.off('moveend', onMapMoveEnd);
      map.destroy();
      map = null;
    }
    geocoder = null;
  });
</script>

<style lang="less" scoped>
  .amap-location-map {
    &__wrap {
      position: relative;
      height: 320px; // 兜底高度(正常情况下由 height prop 覆盖)
      border-radius: 6px;
      overflow: hidden;
      background: #f0f2f5;
    }

    &__map {
      width: 100%;
      height: 100%;
    }

    // 中心定位 pin(tip 锚定地图中心, 不随地图移动)
    &__pin {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -100%);
      z-index: 2;
      pointer-events: none;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));

      &-svg {
        display: block;
      }

      // tip 处脉冲圆环
      &-pulse {
        position: absolute;
        left: 50%;
        bottom: -3px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: rgba(255, 77, 79, 0.35);
        transform: translateX(-50%);
        animation: amap-pin-pulse 1.8s ease-out infinite;
      }
    }

    // 顶部搜索框
    &__search {
      position: absolute;
      left: 12px;
      right: 12px;
      top: 12px;
      z-index: 3;
    }

    // 加载失败提示
    &__error {
      position: absolute;
      left: 12px;
      right: 12px;
      top: 12px;
      z-index: 3;
      padding: 8px 12px;
      background: #fff1f0;
      border: 1px solid #ffa39e;
      border-radius: 4px;
      color: #cf1322;
      font-size: 12px;
    }

    // 底部坐标信息条
    &__bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 8px 12px;
      background: #fff;
      border: 1px solid #f0f0f0;
      border-top: none;
      border-radius: 0 0 6px 6px;
      font-size: 12px;
      color: #666;

      &-item {
        flex-shrink: 0;

        b {
          color: #333;
          font-weight: 600;
        }
      }

      &-addr {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: right;
        color: #333;
      }
    }
  }

  @keyframes amap-pin-pulse {
    0% {
      transform: translateX(-50%) scale(0.5);
      opacity: 0.9;
    }
    70% {
      transform: translateX(-50%) scale(2.4);
      opacity: 0;
    }
    100% {
      transform: translateX(-50%) scale(2.4);
      opacity: 0;
    }
  }
</style>
