'use client'
import { CHAIN_NAMESPACES, SafeEventEmitterProvider } from "@web3auth/base";
import { Web3Auth } from "@web3auth/modal";
import {
  JsonRpcProvider,
  parseEther,
  toQuantity,
  Wallet,
  Contract,
  formatEther
} from "ethers";
import { useEffect, useState } from "react";
import { Client, Presets } from "userop";

export default function Home() {
  const [web3auth,      setWeb3auth]      = useState<Web3Auth | null>(null);
  const [account,       setAccount]       = useState<Presets.Builder.Kernel | null>(null);
  const [loading,       setLoading]       = useState<boolean>(true);
  const [idToken,       setIdToken]       = useState<string | null>(null);
  const [privateKey,    setPrivateKey]    = useState<string | null>(null);
  const [balance,       setBalance]       = useState<string>("");
  const [nativeBalance, setNativeBalance] = useState<string>("");

  // console
  const [events, setEvents] = useState<string[]>([
    `A sample application to demonstrate how to integrate self-custodial\nsocial login and transacting with Web3Auth using userop.js and\nstoring an order in DeDelivery.`,
  ]);

  // env vars
  const rpcUrl            = process.env.NEXT_PUBLIC_RPC_URL;
  const pmUrl             = process.env.NEXT_PUBLIC_PAYMASTER_URL;
  const web3AuthClientId  = process.env.NEXT_PUBLIC_WEB3_AUTH_CLIENT_ID;
  const dummyUSDC         = process.env.NEXT_PUBLIC_DUMMY_USDC_CONTRACT_ADDRESS;
  const dedelivery        = process.env.NEXT_PUBLIC_DEDE_CONTRACT_ADDRESS;

  // abis
  const USDC_ABI = require("../components/usdc.json");
  const DEDE_ABI = require("../components/dede.json");
  
  if (!web3AuthClientId) {
    throw new Error("WEB3AUTH_CLIENT_ID is undefined");
  }
  
  if (!rpcUrl) {
    throw new Error("RPC_URL is undefined");
  }
  
  if (!pmUrl) {
    throw new Error("PAYMASTER_RPC_URL is undefined");
  }

  if (!dummyUSDC && !dedelivery) {
    throw new Error("Contract is undefined");
  }

  if (!USDC_ABI && !DEDE_ABI) {
    throw new Error("ABI is undefined");
  }
  
  // web3 config
  const provider  = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
  const erc20     = new Contract(dummyUSDC, USDC_ABI, provider);
  const dede      = new Contract(dedelivery, DEDE_ABI, provider);

  useEffect(() => {
    const init = async () => {
      try {
        const network = await provider.getNetwork();
        const web3auth = new Web3Auth({
          clientId: web3AuthClientId,
          web3AuthNetwork: "testnet",
          chainConfig: {
            chainNamespace: CHAIN_NAMESPACES.EIP155,
            chainId: toQuantity(network.chainId),
            rpcTarget: process.env.NEXT_PUBLIC_RPC_URL,
          },
        });

        //init web3auth
        await web3auth.initModal();
        setWeb3auth(web3auth);

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const getBalance = async () => {
    if (!account) {
      throw new Error("Account not initialized");
    }

    const balance      = await erc20.balanceOf(account?.getSender());
    const balanceInWei = await provider.getBalance(account?.getSender());

    setBalance(formatEther(balance.toString()))
    setNativeBalance(formatEther(balanceInWei.toString()))
  }

  const createAccount = async (privateKey: string) => {
    const paymasterContext = {type: "payg"};
    
    const paymasterMiddleware = true 
      ? Presets.Middleware.verifyingPaymaster(
        pmUrl,
        paymasterContext
      )
    : undefined;
    
    // build smart wallet with paymaster
    return await Presets.Builder.Kernel.init(
      new Wallet(privateKey) as any,
      rpcUrl,
      { paymasterMiddleware }
    );

  };

  const getPrivateKey = async (provider: SafeEventEmitterProvider) => {
    return (await provider.request({
      method: "private_key",
    })) as string;
  };

  const setAuthorized = async (w3auth: Web3Auth) => {
    if (!w3auth.provider) {
      throw new Error("web3authprovider not initialized yet");
    }

    const authenticateUser = await w3auth.authenticateUser();
    const privateKey       = await getPrivateKey(w3auth.provider);
    const acc              = await createAccount(privateKey);

    setIdToken(authenticateUser.idToken);
    setAccount(acc);
    setPrivateKey(privateKey);
  };

  const login = async () => {
    if (!web3auth) {
      throw new Error("web3auth not initialized yet");
    }

    const web3authProvider = await web3auth.connect();
    
    if (!web3authProvider) {
      throw new Error("web3authprovider not initialized yet");
    }
    
    setAuthorized(web3auth);
  };

  const logout = async () => {
    if (!web3auth) {
      throw new Error("web3auth not initialized yet");
    }

    await web3auth.logout();
    
    setAccount(null);
    setIdToken(null);
    setPrivateKey(null);
  };
  
  const addEvent = (newEvent: string) => {
    setEvents((prevEvents) => [...prevEvents, newEvent]);
  };
  
  const createOrder = async () => {
    setEvents([]);
    if (!account) {
      throw new Error("Account not initialized");
    }
    
    const approve = {
      to: dummyUSDC,
      value: parseEther("0"),
      data: erc20.interface.encodeFunctionData("approve", [dedelivery, parseEther("6")]),
    };

    const send = {
      to: dedelivery,
      value: parseEther("0"),
      data: dede.interface.encodeFunctionData("storeOrder", [0, parseEther("5"), parseEther("1")]),
    };

    const calls = [approve, send];

    addEvent(`Storing order... `);
    
    const client = await Client.init(rpcUrl);
    const res    = await client.sendUserOperation(account.executeBatch(calls), {
      onBuild: async (op) => {
        addEvent(`Signed UserOperation: `);
        addEvent(JSON.stringify(op, null, 2) as any);
      },
    }
  );

  addEvent(`UserOpHash: ${res.userOpHash}`);
  addEvent("Waiting for transaction...");
  
  const ev = await res.wait();
  
  addEvent(`Transaction hash: ${ev?.transactionHash ?? null}`);
  }

  if (loading) {
    return <p>loading...</p>;
  }

  if(account){
    getBalance();
  }

  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-between p-24`}
    >
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <div></div>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
          {idToken ? (
            <div className="space-y-4">
              <div className="flex justify-end space-x-4">
                <p className="flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
                  Logged in as&nbsp;
                  <code className="font-mono font-bold text-green-300">
                    {account?.getSender()}
                  </code>
                </p>
                
                <p className="flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
                  Dummy USDC Balance&nbsp;
                  <code className="font-mono font-bold text-green-300">
                  {balance?.valueOf()}
                  </code>
                </p>

                <p className="flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
                  MuMATIC Balance&nbsp;
                  <code className="font-mono font-bold text-green-300">
                  {nativeBalance?.valueOf()}
                  </code>
                </p>

                <button
                  type="button"
                  onClick={logout}
                  className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 self-center"
                >
                  Logout
                </button>
              </div>
              <div>
                <div className="grid grid-cols-3 grid-rows-2 gap-4">
                  <div className="col-span-1 row-span-2">
                    <button
                      className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
                      onClick={createOrder}
                    >
                      <h2 className={`mb-3 text-2xl font-semibold`}>
                        Store Order{" "}
                      </h2>

                      <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
                        Approve of dummy USDC and storeOrder in DeDelivery for 6 USDC
                      </p>

                    </button>
                    <button
                      className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
                      onClick={() =>
                        privateKey
                          ? setEvents([`Private Key: ${privateKey}`])
                          : undefined
                      }
                    >
                      <h2 className={`mb-3 text-2xl font-semibold`}>
                        Private Key{" "}
                      </h2>

                      <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
                        Print the private key of the account reconstructed by Web3Auth.
                      </p>

                    </button>
                    <button
                      className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
                      onClick={() =>
                        idToken
                          ? setEvents([`OAuth ID Token: ${idToken}`])
                          : undefined
                      }
                    >
                      <h2 className={`mb-3 text-2xl font-semibold`}>
                        OAuth ID Token{" "}
                      </h2>

                      <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
                        Print the OAuth ID Token. This token can be used to authenticate a user on the server.
                      </p>
                      
                    </button>
                  </div>
                  <div className="overflow-scroll col-start-2 col-span-2 row-span-2 border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
                    <div className="w-[1000px]">
                      <div className="block whitespace-pre-wrap justify-center ">
                        <pre>{events.join(`\n`)}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={login}
              className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </main>
  );
}