"use client";

import React, { useEffect, useState } from "react";
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

const shortenAddress = (address: string) => {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};
// 格式化数据为 Highcharts 支持的树形结构
const formatTreeData = (data: any) => {
  const formattedData: any[] = [];
  const isMobile = window.innerWidth <= 768;
  // 添加邀请者作为根节点
  formattedData.push({
    id: "root",
    parent: "",
    name: isMobile ? shortenAddress(data.inviter) : data.inviter,
    wallet: data.inviter,
  });

  // 递归格式化数据
  const recursiveFormat = (children: any[], parentId: string) => {
    if (Array.isArray(children)) {
      children.forEach(child => {
        formattedData.push({
          id: child.invitee,
          parent: parentId,
          name: isMobile ? shortenAddress(child.invitee) : child.invitee,
          wallet: child.invitee,
        });

        if (child.children && child.children.length > 0) {
          recursiveFormat(child.children, child.invitee);
        }
      });
    }
  };

  recursiveFormat(data.invites, "root");
  return formattedData;
};

// Highcharts 图表组件
const HighchartsTreegraph: React.FC<HighchartsTreegraphProps> = ({ data }) => {
  const chartComponentRef = React.useRef<HighchartsReact.RefObject>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize(); // 初始化时检查
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Highcharts 图表配置
  const options: Highcharts.Options = {
    title: {
      text: "Display up to two layers",
    },
    series: [
      {
        type: "treegraph",
        data: formatTreeData(data),
        tooltip: {
          pointFormat: isMobile ? "{point.wallet}" : "{point.name}",
          linkFormat: isMobile ? "{point.wallet}" : "{point.name}",
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