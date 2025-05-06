
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Link } from 'react-router-dom';

const Help = () => {
  const [activeTab, setActiveTab] = useState('getting-started');
  
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Help & Documentation</h1>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
          <TabsTrigger value="twilio">Twilio Setup</TabsTrigger>
          <TabsTrigger value="ai-config">AI Configuration</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>
        
        <TabsContent value="getting-started" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Welcome to eXp Voice AI</CardTitle>
              <CardDescription>
                Follow these steps to start making AI-powered prospecting calls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal ml-6 space-y-4">
                <li>
                  <p className="font-medium">Complete your profile setup</p>
                  <p className="text-muted-foreground text-sm">
                    Add your name, eXp ID, and Twilio credentials in the <Link to="/profile" className="text-blue-600 hover:underline">Profile Settings</Link>.
                  </p>
                </li>
                <li>
                  <p className="font-medium">Import prospects</p>
                  <p className="text-muted-foreground text-sm">
                    Go to the <Link to="/prospects" className="text-blue-600 hover:underline">Prospects</Link> page to upload your contact lists.
                    You can import CSV files with prospect contact information.
                  </p>
                </li>
                <li>
                  <p className="font-medium">Configure your AI agent</p>
                  <p className="text-muted-foreground text-sm">
                    Visit the <Link to="/agent-config" className="text-blue-600 hover:underline">AI Agent</Link> page to set up your virtual assistant.
                    Customize the voice, prompts and behavior of your AI caller.
                  </p>
                </li>
                <li>
                  <p className="font-medium">Create a campaign</p>
                  <p className="text-muted-foreground text-sm">
                    Go to the <Link to="/campaigns" className="text-blue-600 hover:underline">Campaigns</Link> page to create and launch your first calling campaign.
                  </p>
                </li>
                <li>
                  <p className="font-medium">Monitor results</p>
                  <p className="text-muted-foreground text-sm">
                    Check the <Link to="/analytics" className="text-blue-600 hover:underline">Analytics</Link> page to track your campaign performance.
                  </p>
                </li>
              </ol>
              
              <div className="bg-blue-50 p-4 rounded-md mt-4">
                <p className="font-medium text-blue-800">Pro Tip</p>
                <p className="text-blue-700 text-sm">
                  Start with a small test campaign to verify your configuration before launching larger campaigns.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="twilio" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Twilio Setup Guide</CardTitle>
              <CardDescription>
                Step-by-step instructions for configuring Twilio with eXp Voice AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-medium text-lg mb-3">1. Create a Twilio account</h3>
                <p className="text-sm">
                  If you don't already have a Twilio account, sign up at <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">twilio.com</a>.
                </p>
              </div>
              
              <div>
                <h3 className="font-medium text-lg mb-3">2. Get your Twilio credentials</h3>
                <p className="text-sm mb-3">
                  From your Twilio dashboard:
                </p>
                <ol className="list-decimal ml-6 text-sm space-y-2">
                  <li>Find your Account SID (visible on your dashboard)</li>
                  <li>Find your Auth Token (click on "View" to reveal it)</li>
                </ol>
              </div>
              
              <div>
                <h3 className="font-medium text-lg mb-3">3. Purchase a Twilio phone number</h3>
                <p className="text-sm mb-3">
                  In your Twilio account:
                </p>
                <ol className="list-decimal ml-6 text-sm space-y-2">
                  <li>Navigate to "Phone Numbers" → "Buy a Number"</li>
                  <li>Select a number with voice capabilities</li>
                  <li>Complete the purchase</li>
                </ol>
              </div>
              
              <div>
                <h3 className="font-medium text-lg mb-3">4. Configure your eXp Voice AI profile</h3>
                <p className="text-sm mb-3">
                  In your <Link to="/profile" className="text-blue-600 hover:underline">Profile Settings</Link>:
                </p>
                <ol className="list-decimal ml-6 text-sm space-y-2">
                  <li>Enter your Twilio Account SID</li>
                  <li>Enter your Twilio Auth Token</li>
                  <li>Enter your Twilio phone number (with country code, e.g., +15551234567)</li>
                  <li>Save your settings</li>
                </ol>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-md mt-4">
                <p className="font-medium text-yellow-800">Important Note</p>
                <p className="text-yellow-700 text-sm">
                  For production use with high call volumes, you may need to register for 10DLC compliance. 
                  Contact Twilio support for guidance on regulatory compliance for your specific call volume.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="ai-config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Agent Configuration</CardTitle>
              <CardDescription>
                Learn how to customize your AI calling agent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Your AI agent's behavior is determined by several key settings that you can configure:
              </p>
              
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="system-prompt">
                  <AccordionTrigger>System Prompt</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      The system prompt provides overall context and instructions to the AI model.
                      It sets the tone and approach your AI agent will use when speaking with prospects.
                    </p>
                    <div className="bg-slate-50 p-3 rounded text-sm">
                      <p className="font-medium">Example:</p>
                      <p className="text-muted-foreground">
                        "You are a professional real estate assistant calling on behalf of an eXp Realty agent.
                        Your goal is to identify if the prospect is interested in selling their property.
                        Be polite, concise, and listen carefully to their responses."
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="goal-extraction">
                  <AccordionTrigger>Goal Extraction Prompt</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      This prompt helps the AI extract specific information from prospect responses,
                      such as interest level, objections, or follow-up preferences.
                    </p>
                    <div className="bg-slate-50 p-3 rounded text-sm">
                      <p className="font-medium">Example:</p>
                      <p className="text-muted-foreground">
                        "Extract the following information from the prospect's response: 
                        1. Interest level (high, medium, low, none)
                        2. Main objection or concern (if any)
                        3. Preferred follow-up method (call, email, none)
                        4. Best time for follow-up (if applicable)"
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="voice-settings">
                  <AccordionTrigger>Voice Selection</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      Choose from various AI voices to find one that best represents your brand.
                      Different voices have different characteristics in terms of perceived gender,
                      age, accent, and speech patterns.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      We recommend testing several voices to find the one that prospects respond to best.
                      The voice provider (currently ElevenLabs) offers a range of realistic voices.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="llm-model">
                  <AccordionTrigger>AI Model Selection</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      Select which AI model powers your agent. More advanced models offer better
                      comprehension, reasoning, and conversational abilities but may cost more.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      For routine calls, GPT-3.5-Turbo provides a good balance of performance and cost.
                      For complex scenarios or high-value prospects, consider using more advanced models.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="temperature">
                  <AccordionTrigger>Temperature Setting</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      Temperature controls how creative or deterministic your AI agent will be:
                    </p>
                    <ul className="list-disc ml-5 space-y-2 text-sm text-muted-foreground">
                      <li><strong>Lower values (0.0-0.4):</strong> More predictable, focused responses</li>
                      <li><strong>Medium values (0.5-0.7):</strong> Balanced creativity and consistency</li>
                      <li><strong>Higher values (0.8-1.0):</strong> More creative, varied responses</li>
                    </ul>
                    <p className="text-sm text-muted-foreground mt-3">
                      We recommend starting with 0.7 for a good balance between consistency and conversational flexibility.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="faq" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>
                Common questions about eXp Voice AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>How many calls can I make?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">
                      The number of calls you can make depends on your Twilio account balance and the AI model usage.
                      Each call typically costs between $0.02 and $0.10 per minute depending on the chosen AI model,
                      voice quality, and call duration. You can monitor your usage and costs in the Analytics section.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-2">
                  <AccordionTrigger>Is there a limit to how many prospects I can add?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">
                      There is no hard limit on the number of prospects you can add to the system.
                      However, for optimal performance, we recommend importing lists of up to 5,000 prospects at a time.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-3">
                  <AccordionTrigger>How do I comply with calling regulations?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">
                      It's important to comply with all applicable laws and regulations including TCPA in the United States.
                      Make sure you have proper consent to call prospects, respect Do Not Call lists, and call only during
                      permitted hours. For high-volume calling, register for 10DLC compliance through your Twilio account.
                      We recommend consulting with legal counsel regarding your specific calling practices.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-4">
                  <AccordionTrigger>Can I schedule calls for specific times?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">
                      Yes, when creating a campaign, you can schedule it to start at a specific time.
                      The system respects time zones to ensure calls are only made during appropriate hours.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-5">
                  <AccordionTrigger>Can I listen to call recordings?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">
                      Yes, all calls are recorded for quality assurance and training purposes.
                      You can access recordings from the Analytics section or from individual prospect records.
                      Make sure your call script includes a disclosure about call recording if required by local laws.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-6">
                  <AccordionTrigger>How do I get notified about interested prospects?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">
                      When a prospect expresses interest, they are automatically marked in the system.
                      You can view interested prospects in the Dashboard and Analytics sections.
                      We're currently working on email and SMS notification features for immediate alerts.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Help;
