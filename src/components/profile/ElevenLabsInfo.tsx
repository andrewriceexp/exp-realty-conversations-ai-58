
import { Alert, AlertDescription } from '@/components/ui/alert';

const ElevenLabsInfo = () => {
  return (
    <div className="border-t pt-6 mt-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">ElevenLabs Integration</h2>
        <p className="text-sm text-gray-600">
          This application uses the organization's ElevenLabs integration. No personal API key needed.
        </p>
        <Alert className="mt-4 bg-green-50 border-green-200 text-green-800">
          <AlertDescription>
            ElevenLabs voice capabilities are provided through our organizational account. Users don't need to provide their own API keys.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};

export default ElevenLabsInfo;
