<script setup lang="ts">
// 关于页：社团财务报账须知（纯文本说明）
const notes: { text: string; sub?: string[] }[] = [
  {
    text: "发票总额必须等于凭证总额！（注：只需总额相等，不需要发票和凭证“一一对应”）",
  },
  {
    text: "先整电子版，再整纸质版！",
  },
  {
    text: "电子版流程：整理材料 -> 生成电子包 -> 线下发给社管财务部审核 -> 审核通过后，手动在软件里点击通过。",
    sub: [
      "（注意：软件里的“电子审核”只是状态记录，实际动作是你人拿去给社管财务部看！或者叫社长帮忙。）",
      "（社管财务部简单理解就是管理整个社团的总财务部，我们是单个社团的财务部，上面还有学校为单位的财务，这个才是终点）",
    ],
  },
  {
    text: "纸质版流程：电子版审核通过后，再打印纸质版、跑签字。交到303办公室社管柜子财务部那一格后，才能回来点【Step 10 完成归档】。",
    sub: ["（跑签字可以让社长去）"],
  },
  {
    text: "验收单必须要有“纸质”和“电子”两个版本。",
  },
  {
    text: "每一个活动里面都必须要有领取表。",
  },
  {
    text: "验收单只是“低值易耗品验收单”，不是全部物品的验收单。",
  },
  {
    text: "生成电子包时，软件没有默认输出位置，每次都必须手动选择文件夹！",
  },
];
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">关于</h1>
    <div class="bg-white p-6 rounded shadow">
      <ul class="space-y-4 text-sm leading-relaxed text-gray-800">
        <li v-for="(n, i) in notes" :key="i">
          <p>📌 {{ n.text }}</p>
          <p v-for="(s, j) in n.sub" :key="'s' + j" class="ml-5 mt-1 text-gray-500">{{ s }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>
