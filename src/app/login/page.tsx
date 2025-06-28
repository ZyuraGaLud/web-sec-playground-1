"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginRequest, loginRequestSchema } from "@/app/_types/LoginRequest";
import { UserProfile, userProfileSchema } from "../_types/UserProfile";
import { TextInputField } from "@/app/_components/TextInputField";
import { ErrorMsgField } from "@/app/_components/ErrorMsgField";
import { Button } from "@/app/_components/Button";
import { faSpinner, faRightToBracket } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { twMerge } from "tailwind-merge";
import NextLink from "next/link";
import { ApiResponse } from "../_types/ApiResponse";
import Cookies from "js-cookie";
import { z } from "zod"; // zod をインポート

const Page: React.FC = () => {
  const c_Email = "email";
  const c_Password = "password";
  const c_RememberMe = "rememberMe";
  const REMEMBER_ME_COOKIE_NAME = "remember_email";

  const [isPending, setIsPending] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoginCompleted, setIsLoginCompleted] = useState(false);

  // フォーム処理関連の準備と設定
  const formMethods = useForm<LoginRequest>({ // LoginRequest 型を使用
    mode: "onChange",
    resolver: zodResolver(loginRequestSchema), // loginRequestSchema を直接使用
    defaultValues: {
      rememberMe: false, // デフォルトではチェックなし
    },
  });
  const fieldErrors = formMethods.formState.errors;

  // ルートエラー（サーバサイドで発生した認証エラー）の表示設定の関数
  const setRootError = (errorMsg: string) => {
    formMethods.setError("root", {
      type: "manual",
      message: errorMsg,
    });
  };

  // 初期設定
  useEffect(() => {
    // クエリパラメータからメールアドレスの初期値をセット
    const searchParams = new URLSearchParams(window.location.search);
    const emailFromQuery = searchParams.get(c_Email);

    // クッキーからメールアドレスを取得し、クエリパラメータよりも優先
    const emailFromCookie = Cookies.get(REMEMBER_ME_COOKIE_NAME);

    // 初期値として設定
    formMethods.setValue(c_Email, emailFromQuery || emailFromCookie || "");
    // クッキーにメールアドレスがあれば、rememberMe チェックボックスもチェックする
    if (emailFromCookie) {
      formMethods.setValue(c_RememberMe, true);
    }
  }, []);

  // ルートエラーメッセージのクリアに関する設定
  useEffect(() => {
    const subscription = formMethods.watch((value, { name }) => {
      if (name === c_Email || name === c_Password) {
        formMethods.clearErrors("root");
      }
    });
    return () => subscription.unsubscribe();
  }, [formMethods]);

  // ログイン完了後のリダイレクト処理
  useEffect(() => {
    if (isLoginCompleted) {
      window.location.href = "/";
    }
  }, [isLoginCompleted]);

  // フォームの送信処理
  const onSubmit = async (formValues: LoginRequest) => { // LoginRequest 型を使用
    const ep = "/api/login";

    console.log(JSON.stringify(formValues));
    try {
      setIsPending(true);
      setRootError("");

      const res = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
        credentials: "same-origin",
        cache: "no-store",
      });
      setIsPending(false);

      if (!res.ok) return;

      const body = (await res.json()) as ApiResponse<UserProfile | null>;

      if (!body.success) {
        setRootError(body.message);
        return;
      }

      // 「次回からログインIDを自動入力する」チェックボックスの状態に応じてメールアドレスをクッキーに保存/削除
      if (formValues.rememberMe) {
        // セキュアな設定を適用: path, sameSite, secure を設定
        Cookies.set(REMEMBER_ME_COOKIE_NAME, formValues.email, { expires: 30, path: "/", sameSite: "strict", secure: true });
      } else {
        Cookies.remove(REMEMBER_ME_COOKIE_NAME, { path: "/", sameSite: "strict", secure: true });
      }

      setIsLoginCompleted(true);
      setUserProfile(userProfileSchema.parse(body.payload));
    } catch (e) {
      const errorMsg =
        e instanceof Error ? e.message : "予期せぬエラーが発生しました。";
      setRootError(errorMsg);
    }
  };

  return (
    <main>
      <div className="text-2xl font-bold">
        <FontAwesomeIcon icon={faRightToBracket} className="mr-1.5" />
        Login
      </div>
      <form
        noValidate
        onSubmit={formMethods.handleSubmit(onSubmit)}
        className={twMerge(
          "mt-4 flex flex-col gap-y-4",
          isLoginCompleted && "cursor-not-allowed opacity-50",
        )}
      >
        <div>
          <label htmlFor={c_Email} className="mb-2 block font-bold">
            メールアドレス（ログインID）
          </label>
          <TextInputField
            {...formMethods.register(c_Email)}
            id={c_Email}
            placeholder="name@example.com"
            type="email"
            disabled={isPending || isLoginCompleted}
            error={!!fieldErrors.email}
            autoComplete="email"
          />
          <ErrorMsgField msg={fieldErrors.email?.message} />
        </div>

        <div>
          <label htmlFor={c_Password} className="mb-2 block font-bold">
            パスワード
          </label>
          <TextInputField
            {...formMethods.register(c_Password)}
            id={c_Password}
            placeholder="*****"
            type="password"
            disabled={isPending || isLoginCompleted}
            error={!!fieldErrors.password}
            autoComplete="off"
          />
          <ErrorMsgField msg={fieldErrors.password?.message} />
        </div>

        {/* 「次回からログインIDを自動入力する」チェックボックスを追加 */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id={c_RememberMe}
            {...formMethods.register(c_RememberMe)}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            disabled={isPending || isLoginCompleted}
          />
          <label htmlFor={c_RememberMe} className="ml-2 block text-sm text-gray-900">
            次回からログインIDを自動入力する
          </label>
        </div>

        <ErrorMsgField msg={fieldErrors.root?.message} />

        <Button
          variant="indigo"
          width="stretch"
          className={twMerge("tracking-widest")}
          isBusy={isPending}
          disabled={
            !formMethods.formState.isValid || isPending || isLoginCompleted
          }
        >
          ログイン
        </Button>
      </form>

      {isLoginCompleted && (
        <div>
          <div className="mt-4 flex items-center gap-x-2">
            <FontAwesomeIcon icon={faSpinner} spin />
            <div>ようこそ、{userProfile?.name} さん。</div>
          </div>
          <NextLink href="/" className="text-blue-500 hover:underline">
            自動的に画面が切り替わらないときはこちらをクリックしてください。
          </NextLink>
        </div>
      )}
    </main>
  );
};

export default Page;