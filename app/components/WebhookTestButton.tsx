import { useState } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { WEBHOOK_URL, ensureProperProtocol, testWebhook } from '../utils/webhook';

interface WebhookTestButtonProps {
  className?: string;
  webhookUrl?: string; // Optional custom webhook URL
}

export default function WebhookTestButton({ className = '', webhookUrl = WEBHOOK_URL }: WebhookTestButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleTestWebhook = async () => {
    setIsLoading(true);
    setTestResult(null);
    setErrorMessage('');

    try {
      // Use the testWebhook function from the webhook utility
      // Set a longer timeout (60 seconds) for the test to ensure it has time to complete
      await testWebhook(webhookUrl, 60000);
      setTestResult('success');
    } catch (error) {
      setTestResult('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col items-start ${className}`}>
      <button
        onClick={handleTestWebhook}
        disabled={isLoading}
        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Testing Webhook...
          </>
        ) : (
          <>Test Webhook</>
        )}
      </button>

      {testResult === 'success' && (
        <div className="mt-2 flex items-center text-green-600">
          <CheckCircle className="w-4 h-4 mr-1" />
          <span>Webhook is active and responding</span>
        </div>
      )}

      {testResult === 'error' && (
        <div className="mt-2 flex items-start text-red-600">
          <AlertCircle className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Webhook test failed</p>
            <p className="text-sm">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
} 