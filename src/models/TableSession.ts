import { Schema, model, Types} from 'mongoose';
import crypto from 'crypto';

export type TableSessionStatus = 'ACTIVE' | 'CLOSED' | 'RESET';

// ใช้กับฝั่ง controller/middleware เวลา hash token (ไม่เก็บ token แบบ plain ใน DB)
// แชทว่ามางี้วะ
export function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

const tableSessionSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    tableNo:      { type: String, required: true, trim: true, index: true },
    tokenHash:    { type: String, required: true, unique: true },
    status:       { type: String, enum: ['ACTIVE', 'CLOSED', 'RESET'], default: 'ACTIVE', index: true },
    openedAt:     { type: Date, default: Date.now },
    expiresAt:    { type: Date },
    lastActiveAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

//TTL index เพื่อให้ Mongo ลบข้อมูลเองตอน expiresAt
tableSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
//active table
tableSessionSchema.index({ restaurantId: 1, tableNo: 1, status: 1 });

export default model('TableSession', tableSessionSchema);