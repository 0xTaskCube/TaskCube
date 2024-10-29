"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
// 引入其他风格选项
import { adventurer, adventurerNeutral, funEmoji, openPeeps, personas } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { AvatarComponent } from "@rainbow-me/rainbowkit";

export const BlockieAvatar: AvatarComponent = ({ address, ensImage, size }) => {
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    const generateAvatar = async () => {
      if (!ensImage && address) {
        // 选择以下任意一种风格：

        // 1. adventurer - 冒险家风格，可爱活泼
        // const avatar = createAvatar(adventurer, {
        //   seed: address,
        //   size: 128,
        //   backgroundColor: ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf"],
        // });

        // 2. funEmoji - 有趣的表情符号
        const avatar = createAvatar(adventurerNeutral, {
          seed: address,
          size: 128,
          backgroundColor: ["2c3e50", "8e44ad", "16a085", "c0392b", "f39c12"],
        });

        // 3. lorelei - 可爱的卡通人物
        // const avatar = createAvatar(lorelei, {
        //   seed: address,
        //   size: 128,
        //   backgroundColor: ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf"],
        // });

        // 4. openPeeps - 开放友好的人物形象
        // const avatar = createAvatar(openPeeps, {
        //   seed: address,
        //   size: 128,
        // });

        // 5. personas - 现代风格的人物头像
        // const avatar = createAvatar(personas, {
        //   seed: address,
        //   size: 128,
        //   backgroundColor: ["b6e3f4","c0aede","d1d4f9","ffd5dc","ffdfbf"],
        // });

        const uri = await avatar.toDataUri();
        setAvatarUri(uri);
      }
    };

    generateAvatar();
  }, [address, ensImage]);

  return (
    <div className="relative rounded-full overflow-hidden  shadow-lg" style={{ width: size, height: size }}>
      {(ensImage || avatarUri) && (
        <Image src={ensImage || avatarUri || ""} alt={`${address} avatar`} layout="fill" objectFit="cover" />
      )}
    </div>
  );
};
