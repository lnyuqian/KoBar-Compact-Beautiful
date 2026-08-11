import React, { useState } from 'react';

interface LicenseActivationModalProps {
    onSuccess: () => void;
}

const LicenseActivationModal: React.FC<LicenseActivationModalProps> = ({ onSuccess }) => {
    const [licenseKey, setLicenseKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const checkLicense = async (key: string, hwid: string, forceTransfer: boolean = false) => {
        const payload = {
            license_key: key,
            hardware_id: hwid,
            force_transfer: forceTransfer
        };

        const response = await fetch('YOUR_LICENSE_API_ENDPOINT_HERE', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        return response;
    };

    const handleActivate = async () => {
        if (!licenseKey.trim()) {
            setError('请输入许可证密钥。');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const hwid = await window.api.getHwid();
            let response = await checkLicense(licenseKey.trim(), hwid, false);
            let result = await response.json();

            if (response.status === 403) {
                if (result.error === 'device_mismatch') {
                    const confirmTransfer = window.confirm('该许可证已在另一台设备上激活。是否要解除旧设备并在此处转移许可证？');
                    if (confirmTransfer) {
                        response = await checkLicense(licenseKey.trim(), hwid, true);
                        result = await response.json();
                    } else {
                        setIsLoading(false);
                        return; // User cancelled
                    }
                } else {
                    throw new Error(result.error || '激活失败');
                }
            }

            if (response.ok) {
                // Success (200)
                localStorage.setItem('kobar_license_key', licenseKey.trim());
                onSuccess();
            } else {
                setError(result.error || '无效的许可证密钥。');
            }
        } catch (err: any) {
            console.error('许可证检查出错:', err);
            setError(err.message || '发生网络错误，请重试。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none">
            <div className="w-[320px] rounded-2xl border p-6 shadow-2xl animate-in fade-in zoom-in duration-300 pointer-events-auto flex flex-col pt-8"
                 style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
                
                <div className="flex flex-col items-center mb-6">
                    <h2 className="text-xl font-bold text-primary">激活 KoBar</h2>
                    <p className="text-sm text-slate-400 text-center mt-2">输入许可证密钥以在此设备上继续使用 KoBar。</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <input
                            type="text"
                            value={licenseKey}
                            onChange={(e) => setLicenseKey(e.target.value)}
                            placeholder="XXXX-XXXX-XXXX-XXXX"
                            disabled={isLoading}
                            className="w-full bg-black/30 border rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-primary disabled:opacity-50 text-center font-mono tracking-widest placeholder:tracking-normal placeholder:font-sans"
                            style={{ borderColor: 'var(--theme-border)' }}
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-2 w-full mt-4">
                        <button
                            onClick={() => window.api.quitApp()}
                            className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 font-semibold transition-all hover:bg-red-500/20"
                        >
                            <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
                            Exit
                        </button>
                        <button
                            onClick={handleActivate}
                            disabled={isLoading || !licenseKey.trim()}
                            className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-black font-semibold transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-[18px]">key</span>
                            )}
                            {isLoading ? '验证中...' : '激活'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LicenseActivationModal;
