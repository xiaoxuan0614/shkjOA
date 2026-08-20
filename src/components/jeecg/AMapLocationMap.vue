<template>
  <div class="amap-location-map">
    <div class="amap-location-map__wrap" :style="{ height }">
      <!-- 地图 -->
      <div ref="mapRef" class="amap-location-map__map"></div>

      <!-- 定位 pin(绝对定位覆盖在地图中心, tip 即地图中心点) -->
      <div class="amap-location-map__pin">
        <div class="amap-location-map__pin-pulse"></div>
        <svg
          class="amap-location-map__pin-svg"
          width="40"
          height="52"
          viewBox="0 0 40 52"
          xmlns="http://www.w3.org/2000/svg"
        >
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
        <AMapPlaceSearch
          :value="searchKeyword"
          :disabled="disabled"
          placeholder="搜索地点，拖动地图可微调定位"
          @select="onSearchSelect"
        />
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
  import AMapPlaceSearch, { AmapPoi } from './AMapPlaceSearch.vue';
  import { loadAMap } from '/@/utils/amap';

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
    }>(),
    {
      lng: null,
      lat: null,
      height: '320px',
    }
  );

  const emit = defineEmits<{
    (e: 'update:lng', value: number | null): void;
    (e: 'update:lat', value: number | null): void;
    (e: 'update:address', value: string): void;
    /** 选点结果: name/address/lng/lat; null 表示清空 */
    (e: 'select', poi: AmapPoi | null): void;
  }>();

  // 内部状态
  const mapRef = ref<HTMLDivElement | null>(null);
  const lng = ref<number | null>(props.lng ?? null);
  const lat = ref<number | null>(props.lat ?? null);
  const address = ref<string>(props.address ?? '');
  const searchKeyword = ref<string>(props.address ?? '');
  const errorMsg = ref('');

  let map: any = null;
  let geocoder: any = null;

  /** 同步外部经纬度(lng/lat 变化时地图飞过去) */
  watch(
    () => [props.lng, props.lat] as const,
    ([nl, na]) => {
      if (map && nl != null && na != null) {
        const c = map.getCenter();
        if (Math.abs(c.getLng() - nl) > 1e-7 || Math.abs(c.getLat() - na) > 1e-7) {
          map.setCenter([nl, na], true);
        }
      }
    }
  );

  // 只读: 禁用地图交互(拖动/缩放/滚轮)
  watch(
    () => props.disabled,
    (d) => {
      if (!map) return;
      map.setStatus({
        dragEnable: !d,
        zoomEnable: !d,
        scrollWheel: !d,
        doubleClickZoom: !d,
        keyboardEnable: !d,
      });
    }
  );

  watch(
    () => props.address,
    (v) => {
      if (v) address.value = v;
    }
  );

  /** 拖拽结束: 取中心点经纬度 + 逆地理编码回填地址 */
  function onMapMoveEnd() {
    if (!map) return;
    const c = map.getCenter();
    lng.value = c.getLng();
    lat.value = c.getLat();
    emit('update:lng', lng.value);
    emit('update:lat', lat.value);
    // 逆地理编码拿地址
    if (!geocoder) return;
    geocoder.getAddress([c.getLng(), c.getLat()], (status: string, result: any) => {
      if (status === 'complete' && result?.regeocode) {
        const addr = result.regeocode.formattedAddress || '';
        address.value = addr;
        searchKeyword.value = addr;
        emit('update:address', addr);
        emit('select', { name: addr, address: addr, lng: lng.value, lat: lat.value });
      }
    });
  }

  /** 搜索选中: 地图飞过去并回填 */
  function onSearchSelect(poi: AmapPoi | null) {
    if (!poi || poi.lng == null || poi.lat == null) return;
    map.setCenter([poi.lng, poi.lat], true);
    lng.value = poi.lng;
    lat.value = poi.lat;
    emit('update:lng', poi.lng);
    emit('update:lat', poi.lat);
    const addr = poi.address || poi.name;
    address.value = addr;
    searchKeyword.value = addr;
    emit('update:address', addr);
    emit('select', { name: poi.name, address: addr, lng: poi.lng, lat: poi.lat });
  }

  /** 初始化地图 */
  async function initMap() {
    if (!mapRef.value) return;
    let AMap: any;
    try {
      AMap = await loadAMap();
    } catch (e) {
      errorMsg.value = '地图加载失败，请检查网络或高德 key 配置';
      return;
    }
    if (!mapRef.value) return;
    const center: [number, number] =
      props.lng != null && props.lat != null ? [props.lng, props.lat] : [116.397428, 39.90923];
    map = new AMap.Map(mapRef.value, {
      zoom: props.lng != null ? 15 : 11,
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
    map.on('moveend', onMapMoveEnd);
    // 初始点回显: 已有坐标则逆地理编码补全地址
    if (props.lng != null && props.lat != null && !address.value) {
      onMapMoveEnd();
    }
  }

  onMounted(() => {
    initMap();
  });

  onBeforeUnmount(() => {
    if (map) {
      map.off('moveend', onMapMoveEnd);
      map.destroy();
      map = null;
    }
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
