"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = __importDefault(require("../src/models/User"));
async function run() {
    const uri = process.env.MONGODB_URI;
    await mongoose_1.default.connect(uri);
    const email = process.env.ADMIN_EMAIL;
    const exist = await User_1.default.findOne({ email });
    if (exist) {
        console.log('Admin already exists:', email);
        process.exit(0);
    }
    const hashed = await bcryptjs_1.default.hash(process.env.ADMIN_PASSWORD, 10);
    await User_1.default.create({
        name: process.env.ADMIN_NAME || 'Admin',
        phone: process.env.ADMIN_PHONE,
        email,
        password: hashed,
        role: 'admin'
    });
    console.log('Admin seeded:', email);
    process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=seedAdmin.js.map