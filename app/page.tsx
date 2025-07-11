'use client'

import { signInWithSlack } from "@/lib/auth/slack";
import { useRouter } from "next/navigation";

import { useEffect } from "react";
import { getUser } from "../lib/utils/getUser";
import { useUserStore } from "../lib/store/userStore";
import React, { useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const slackIcon = "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/1024px-Slack_icon_2019.svg.png";
  const neighborhoodVideo = "https://hc-cdn.hel1.your-objectstorage.com/s/v3/3838e7c0f3d7d5bcc703ca27234178b047a94160_background.mp4";
  const neighborhoodLogo = "https://hc-cdn.hel1.your-objectstorage.com/s/v3/d577e8ac81ecfd65fe88e66bf25ed308ff14d11f_neighborhoodlogo.png";
  const router = useRouter();
  const { user, setUser } = useUserStore();

  const onHandleStart = async () => {
    try {
      await signInWithSlack();
    } catch (error) {
      alert('hey! auth failed, please try again later: ' + error);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const fetchedUser = await getUser();
      setUser(fetchedUser);
      if (fetchedUser) {
        router.push("/map");
      } else {
        setLoading(false);
      }
    };
    checkUser();
  }, [router, setUser]);

  if (loading) {
    const LoadingPage = require("../components/LoadingPage").default;
    return <LoadingPage />;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      <video
        src={neighborhoodVideo}
        autoPlay
        loop
        muted
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
      </video>
      <div className="flex flex-col items-center justify-center relative z-20">
        <img
          src={neighborhoodLogo}
          className="w-64 h-64 object-contain"
        />
        <button
          className="flex items-center gap-2 px-6 py-2 rounded-lg text-white font-bold text-lg shadow-md transition duration-200 hover:brightness-110 hover:scale-105 hover:shadow-xl"
          style={{ background: '#611f69' }}
          onClick={onHandleStart}
        >
          <img src={slackIcon} alt="Slack" className="w-6 h-6" />
          Start!
        </button>
      </div>
    </main>
  );
}
