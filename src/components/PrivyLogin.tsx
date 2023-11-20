import React, { useEffect } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth';

const PrivyLogin = () => {

    const { login } = usePrivy();

    const { wallets } = useWallets()

    useEffect(() => {
        console.log('WALLETS: ', wallets)
    }, [wallets])

    return (
        <div>
            <button
                type="button"
                onClick={login}
                className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
                Login with Privy
            </button>
        </div>
    )
}

export default PrivyLogin
