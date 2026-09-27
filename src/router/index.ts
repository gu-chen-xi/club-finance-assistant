import { createRouter, createWebHashHistory } from "vue-router";

// 路由懒加载，见 UI_TREE.md §0
const routes = [
  { path: "/", redirect: "/dashboard" },
  { path: "/dashboard", name: "dashboard", component: () => import("../views/Dashboard.vue"), meta: { title: "工作台" } },
  { path: "/activities", name: "activities", component: () => import("../views/Activities.vue"), meta: { title: "活动报账" } },
  { path: "/activities/:id", name: "activity-flow", component: () => import("../views/Flow.vue"), meta: { title: "活动流水线" } },
  { path: "/ledger", name: "ledger", component: () => import("../views/Ledger.vue"), meta: { title: "总账" } },
  { path: "/tracking", name: "tracking", component: () => import("../views/Tracking.vue"), meta: { title: "报销跟踪" } },
  { path: "/templates", name: "templates", component: () => import("../views/Templates.vue"), meta: { title: "模板库" } },
  { path: "/settings", name: "settings", component: () => import("../views/Settings.vue"), meta: { title: "设置" } },
  { path: "/about", name: "about", component: () => import("../views/About.vue"), meta: { title: "关于" } },
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
});
