import React from 'react'
import { usePrivy } from '@privy-io/react-auth';

const PrivyLogin = () => {

    const { login } = usePrivy();

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
