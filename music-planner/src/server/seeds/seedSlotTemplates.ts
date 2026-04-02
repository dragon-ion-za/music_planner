import { initAssociations } from '../models/associations';
import { SlotTemplate } from '../models/SlotTemplate';

interface SlotDefinition {
  slotKey: string;
  displayOrder: number;
  category: string;
}

const DEFAULT_SLOTS: SlotDefinition[] = [
  { slotKey: 'orchestra1',      displayOrder: 1,  category: 'orchestra' },
  { slotKey: 'orchestra2',      displayOrder: 2,  category: 'orchestra' },
  { slotKey: 'orchestra3',      displayOrder: 3,  category: 'orchestra' },
  { slotKey: 'orchestra4',      displayOrder: 4,  category: 'orchestra' },
  { slotKey: 'orchestra5',      displayOrder: 5,  category: 'orchestra' },
  { slotKey: 'choir1',          displayOrder: 6,  category: 'choir' },
  { slotKey: 'choir2',          displayOrder: 7,  category: 'choir' },
  { slotKey: 'choir3',          displayOrder: 8,  category: 'choir' },
  { slotKey: 'choir4',          displayOrder: 9,  category: 'choir' },
  { slotKey: 'congregationBS',  displayOrder: 10, category: 'congregation' },
  { slotKey: 'congregationOH',  displayOrder: 11, category: 'congregation' },
  { slotKey: 'congregationRP',  displayOrder: 12, category: 'congregation' },
  { slotKey: 'congregationCM1', displayOrder: 13, category: 'congregation' },
  { slotKey: 'congregationCM2', displayOrder: 14, category: 'congregation' },
];

const SERVICE_TYPE = 'Sunday Service';

export async function seedSlotTemplates(congregationId: string): Promise<void> {
  initAssociations();

  for (const slot of DEFAULT_SLOTS) {
    await SlotTemplate.upsert({
      congregationId,
      serviceType: SERVICE_TYPE,
      slotKey: slot.slotKey,
      displayOrder: slot.displayOrder,
      category: slot.category,
    });
  }

  console.log(`Seeded ${DEFAULT_SLOTS.length} slot templates for congregation ${congregationId}.`);
}

// CLI invocation
if (require.main === module) {
  const congregationId = process.argv[2];
  if (!congregationId) {
    console.error('Usage: seedSlotTemplates <congregationId>');
    process.exit(1);
  }

  seedSlotTemplates(congregationId)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
