import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

interface FormData {
  name: string;
  description: string;
  tier: string;
  trial_period_days: number;
  price: number;
  currency: string;
  billing_cycle: string;
  is_active: boolean;
  limits: {
    businesses: number;
    strategies: number;
    milestones: {
      total: number;
      stages: string[];
    };
    financial_tracking: {
      receipts_per_month: number;
      ocr_enabled: boolean;
    };
    ai_summary: {
      type: string;
      count: string;
    };
    share_download: {
      whatsapp: string;
      email: string;
      downloads_per_month: number;
      formats: string[];
    };
  };
  feature_descriptions: {
    business_strategy: string;
    milestones: string;
    financial_tracking: string;
    ai_summary: string;
    share_download: string;
  };
}

interface PlanFormProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
}

const MILESTONE_STAGES = ['idea', 'concept', 'early_stage', 'growth', 'mature'];
const DOWNLOAD_FORMATS = ['pdf', 'excel'];

export function SubscriptionPlanForm({ formData, setFormData }: PlanFormProps) {
  const updateField = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const updateLimit = (path: string[], value: any) => {
    const newLimits = { ...formData.limits };
    let current: any = newLimits;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    
    setFormData({ ...formData, limits: newLimits });
  };

  const toggleStage = (stage: string) => {
    const stages = formData.limits.milestones.stages;
    const newStages = stages.includes(stage)
      ? stages.filter(s => s !== stage)
      : [...stages, stage];
    updateLimit(['milestones', 'stages'], newStages);
  };

  const toggleFormat = (format: string) => {
    const formats = formData.limits.share_download.formats;
    const newFormats = formats.includes(format)
      ? formats.filter(f => f !== format)
      : [...formats, format];
    updateLimit(['share_download', 'formats'], newFormats);
  };

  const updateDescription = (key: string, value: string) => {
    setFormData({
      ...formData,
      feature_descriptions: {
        ...formData.feature_descriptions,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
      {/* Section 1: Basic Info */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm">Basic Information</h3>
        <div>
          <Label htmlFor="name">Plan Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g., Essential, Pro"
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Brief description of the plan"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="tier">Tier</Label>
            <Select value={formData.tier} onValueChange={(value) => updateField('tier', value)}>
              <SelectTrigger id="tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="essential">Essential</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="trial_days">Trial Period (Days)</Label>
            <Input
              id="trial_days"
              type="number"
              value={formData.trial_period_days}
              onChange={(e) => updateField('trial_period_days', parseInt(e.target.value) || 0)}
              disabled={formData.tier !== 'free'}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Section 2: Plan Limits */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm">Plan Limits (Gating)</h3>
        <p className="text-xs text-muted-foreground">Use -1 or 0 for unlimited</p>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="max_businesses">Max Businesses</Label>
            <Input
              id="max_businesses"
              type="number"
              value={formData.limits.businesses}
              onChange={(e) => updateLimit(['businesses'], parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="max_strategies">Max Strategies</Label>
            <Input
              id="max_strategies"
              type="number"
              value={formData.limits.strategies}
              onChange={(e) => updateLimit(['strategies'], parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <div>
          <Label>Milestones</Label>
          <div className="space-y-2 mt-2">
            <div>
              <Label htmlFor="max_milestones" className="text-xs">Total Limit</Label>
              <Input
                id="max_milestones"
                type="number"
                value={formData.limits.milestones.total}
                onChange={(e) => updateLimit(['milestones', 'total'], parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Allowed Stages</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {MILESTONE_STAGES.map((stage) => (
                  <div key={stage} className="flex items-center space-x-2">
                    <Checkbox
                      id={`stage-${stage}`}
                      checked={formData.limits.milestones.stages.includes(stage)}
                      onCheckedChange={() => toggleStage(stage)}
                    />
                    <Label htmlFor={`stage-${stage}`} className="text-xs capitalize cursor-pointer">
                      {stage.replace('_', ' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <Label>Financial Tracking</Label>
          <div className="space-y-2 mt-2">
            <div>
              <Label htmlFor="receipts_month" className="text-xs">Receipts per Month</Label>
              <Input
                id="receipts_month"
                type="number"
                value={formData.limits.financial_tracking.receipts_per_month}
                onChange={(e) => updateLimit(['financial_tracking', 'receipts_per_month'], parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ocr_enabled"
                checked={formData.limits.financial_tracking.ocr_enabled}
                onCheckedChange={(checked) => updateLimit(['financial_tracking', 'ocr_enabled'], checked)}
              />
              <Label htmlFor="ocr_enabled" className="text-xs cursor-pointer">OCR Enabled</Label>
            </div>
          </div>
        </div>

        <div>
          <Label>AI Summary</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <Label htmlFor="ai_type" className="text-xs">Type</Label>
              <Select
                value={formData.limits.ai_summary.type}
                onValueChange={(value) => updateLimit(['ai_summary', 'type'], value)}
              >
                <SelectTrigger id="ai_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="lite">Lite</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ai_count" className="text-xs">Count</Label>
              <Input
                id="ai_count"
                value={formData.limits.ai_summary.count}
                onChange={(e) => updateLimit(['ai_summary', 'count'], e.target.value)}
                placeholder="unlimited or number"
              />
            </div>
          </div>
        </div>

        <div>
          <Label>Share & Download</Label>
          <div className="space-y-2 mt-2">
            <div>
              <Label htmlFor="downloads_month" className="text-xs">Downloads per Month</Label>
              <Input
                id="downloads_month"
                type="number"
                value={formData.limits.share_download.downloads_per_month}
                onChange={(e) => updateLimit(['share_download', 'downloads_per_month'], parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Download Formats</Label>
              <div className="flex gap-4 mt-1">
                {DOWNLOAD_FORMATS.map((format) => (
                  <div key={format} className="flex items-center space-x-2">
                    <Checkbox
                      id={`format-${format}`}
                      checked={formData.limits.share_download.formats.includes(format)}
                      onCheckedChange={() => toggleFormat(format)}
                    />
                    <Label htmlFor={`format-${format}`} className="text-xs capitalize cursor-pointer">
                      {format}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Section 3: Feature Descriptions */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm">Feature Descriptions (User-Facing)</h3>
        
        <div>
          <Label htmlFor="desc_business">Business Strategy</Label>
          <Textarea
            id="desc_business"
            value={formData.feature_descriptions.business_strategy}
            onChange={(e) => updateDescription('business_strategy', e.target.value)}
            placeholder="e.g., All templates + start from scratch (1 strategy project)"
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="desc_milestones">Milestones</Label>
          <Textarea
            id="desc_milestones"
            value={formData.feature_descriptions.milestones}
            onChange={(e) => updateDescription('milestones', e.target.value)}
            placeholder="e.g., All stages, up to 20 milestones (with suggestions)"
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="desc_financial">Financial Tracking</Label>
          <Textarea
            id="desc_financial"
            value={formData.feature_descriptions.financial_tracking}
            onChange={(e) => updateDescription('financial_tracking', e.target.value)}
            placeholder="e.g., 100 receipts/month (OCR + categorization)"
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="desc_ai">AI Summary</Label>
          <Textarea
            id="desc_ai"
            value={formData.feature_descriptions.ai_summary}
            onChange={(e) => updateDescription('ai_summary', e.target.value)}
            placeholder="e.g., Unlimited lite summaries"
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="desc_share">Share & Download</Label>
          <Textarea
            id="desc_share"
            value={formData.feature_descriptions.share_download}
            onChange={(e) => updateDescription('share_download', e.target.value)}
            placeholder="e.g., Unlimited WhatsApp/email, 5 downloads/month"
            rows={2}
          />
        </div>
      </div>

      <Separator />

      {/* Section 4: Status */}
      <div className="flex items-center space-x-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => updateField('is_active', checked)}
        />
        <Label htmlFor="is_active">Active</Label>
      </div>
    </div>
  );
}
