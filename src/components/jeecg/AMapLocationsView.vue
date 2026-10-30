<template>
  <div>
    <a-alert v-if="error" type="error" :message="error" show-icon />
    <div ref="container" :style="{ height }" class="locations-map"></div>
    <a-button :disabled="!ready" @click="fit">显示全部锚点</a-button>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { loadAMap } from '/@/utils/amap';
const props=defineProps<{ points: { index:number; lng:number; lat:number; name:string }[]; selectedIndex:number; height:string }>();
const emit=defineEmits<{(e:'select',index:number):void}>();
const container=ref<HTMLDivElement>(), error=ref(''), ready=ref(false);
let map:any, sdk:any, markers:any[]=[];
let disposed=false;
function fit(){if(map && markers.length)map.setFitView(markers,true,[45,45,45,45],16);}
function highlight(){markers.forEach((marker,i)=>marker.setzIndex(props.points[i]?.index===props.selectedIndex?200:100));}
function render(){
  if(!map)return;
  markers.forEach(marker=>marker.setMap(null));
  markers=props.points.map(point=>{
    const marker=new sdk.Marker({position:[point.lng,point.lat],draggable:false,clickable:true,title:point.name,anchor:'bottom-center'});
    marker.on('click',()=>{if(!disposed)emit('select',point.index);});
    map.add(marker);return marker;
  });
  highlight();fit();
}
watch(()=>props.points,render,{deep:true});
watch(()=>props.selectedIndex,highlight);
onMounted(async()=>{
  try{sdk=await loadAMap();if(disposed||!container.value)return;
    map=new sdk.Map(container.value,{resizeEnable:true,zoom:12,center:[props.points[0].lng,props.points[0].lat],viewMode:'2D',dragEnable:true,zoomEnable:true,scrollWheel:true});
    render();ready.value=true;
  }catch{if(!disposed)error.value='地图加载失败，请关闭后重试；下方仍可查看位置信息。';}
});
onBeforeUnmount(()=>{disposed=true;markers.forEach(marker=>marker.setMap(null));markers=[];map?.destroy();map=null;});
</script>
<style scoped>.locations-map{width:100%;margin-bottom:8px;border-radius:6px;overflow:hidden}</style>
