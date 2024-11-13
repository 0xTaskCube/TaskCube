"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { adventurer, adventurerNeutral, funEmoji, openPeeps, personas } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { AvatarComponent } from "@rainbow-me/rainbowkit";

export const BlockieAvatar: AvatarComponent = ({ address, ensImage, size }) => {
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    const generateAvatar = async () => {
      if (!ensImage && address) {
        const avatar = createAvatar(adventurerNeutral, {
          seed: address,
          size: 128,
          backgroundColor: ["2c3e50", "8e44ad", "16a085", "c0392b", "f39c12"],
        });

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
