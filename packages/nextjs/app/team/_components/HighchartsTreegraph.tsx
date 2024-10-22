"use client";

import React from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import HC_accessibility from "highcharts/modules/accessibility";
import HC_treegraph from "highcharts/modules/treegraph";
import HC_treemap from "highcharts/modules/treemap";

interface HighchartsTreegraphProps {
  data: any[];
}

// 初始化 Highcharts 模块
if (typeof Highcharts === "object") {
  HC_treemap(Highcharts);
  HC_treegraph(Highcharts);
  HC_accessibility(Highcharts);
}

// 格式化数据为 Highcharts 支持的树形结构
const formatTreeData = (data: any) => {
  const formattedData: any[] = [];

  // 添加邀请者作为根节点
  formattedData.push({
    id: "root", // 为根节点设定 id
    parent: "",
    name: `${data.inviter}`, // 显示邀请者的钱包地址
    wallet: data.inviter,
  });

  // 递归格式化数据
  const recursiveFormat = (children: any[], parentId: string) => {
    if (Array.isArray(children)) {
      children.forEach(child => {
        formattedData.push({
          id: child.invitee,
          parent: parentId, // 设置父节点
          name: `${child.invitee}`, // 显示被邀请者的钱包地址
          wallet: child.invitee,
        });

        if (child.children && child.children.length > 0) {
          recursiveFormat(child.children, child.invitee); // 递归处理子节点
        }
      });
    }
  };

  recursiveFormat(data.invites, "root"); // 从根节点开始递归
  return formattedData;
};

// Highcharts 图表组件
const HighchartsTreegraph: React.FC<HighchartsTreegraphProps> = ({ data }) => {
  const chartComponentRef = React.useRef<HighchartsReact.RefObject>(null);

  // Highcharts 图表配置
  const options: Highcharts.Options = {
    title: {
      text: "Team Treegraph",
    },
    series: [
      {
        type: "treegraph",
        data: formatTreeData(data),
        tooltip: {
          pointFormat: "{point.name}",
          linkFormat: "{point.name}",
        },
        marker: {
          symbol: "rect",
          width: "25%",
          height: "8%",
        },
        borderRadius: 10,
        dataLabels: {
          style: {
            whiteSpace: "nowrap",
            fontSize: "13px",
          },
        },
        levels: [
          {
            level: 1,
            colorByPoint: true,
          },
          {
            level: 2,
            colorByPoint: true,
          },
          {
            level: 3,
            colorVariation: {
              key: "brightness",
              to: -0.5,
            },
          },
        ],
      } as any,
    ],
    chart: {
      backgroundColor: "transparent",
    },
    credits: {
      enabled: false,
    },
  };

  return (
    <div>
      <HighchartsReact highcharts={Highcharts} options={options} ref={chartComponentRef} />
    </div>
  );
};

export default HighchartsTreegraph;
