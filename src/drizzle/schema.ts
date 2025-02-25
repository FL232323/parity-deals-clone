import { subscriptionTiers, TierNames } from "@/data/subscriptionTiers"
import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
  integer,
} from "drizzle-orm/pg-core"

const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow()
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date())

// ----- Original PPP Tables -----

export const ProductTable = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    description: text("description"),
    createdAt,
    updatedAt,
  },
  table => ({
    clerkUserIdIndex: index("products.clerk_user_id_index").on(
      table.clerkUserId
    ),
  })
)

export const productRelations = relations(ProductTable, ({ one, many }) => ({
  productCustomization: one(ProductCustomizationTable),
  productViews: many(ProductViewTable),
  countryGroupDiscounts: many(CountryGroupDiscountTable),
}))

export const ProductCustomizationTable = pgTable("product_customizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  classPrefix: text("class_prefix"),
  productId: uuid("product_id")
    .notNull()
    .references(() => ProductTable.id, { onDelete: "cascade" })
    .unique(),
  locationMessage: text("location_message")
    .notNull()
    .default(
      "Hey! It looks like you are from <b>{country}</b>. We support Parity Purchasing Power, so if you need it, use code <b>\"{coupon}\"</b> to get <b>{discount}%</b> off."
    ),
  backgroundColor: text("background_color")
    .notNull()
    .default("hsl(193, 82%, 31%)"),
  textColor: text("text_color").notNull().default("hsl(0, 0%, 100%)"),
  fontSize: text("font_size").notNull().default("1rem"),
  bannerContainer: text("banner_container").notNull().default("body"),
  isSticky: boolean("is_sticky").notNull().default(true),
  createdAt,
  updatedAt,
})

export const productCustomizationRelations = relations(
  ProductCustomizationTable,
  ({ one }) => ({
    product: one(ProductTable, {
      fields: [ProductCustomizationTable.productId],
      references: [ProductTable.id],
    }),
  })
)

export const ProductViewTable = pgTable("product_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => ProductTable.id, { onDelete: "cascade" }),
  countryId: uuid("country_id").references(() => CountryTable.id, {
    onDelete: "cascade",
  }),
  visitedAt: timestamp("visited_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const productViewRelations = relations(ProductViewTable, ({ one }) => ({
  product: one(ProductTable, {
    fields: [ProductViewTable.productId],
    references: [ProductTable.id],
  }),
  country: one(CountryTable, {
    fields: [ProductViewTable.countryId],
    references: [CountryTable.id],
  }),
}))

export const CountryTable = pgTable("countries", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  countryGroupId: uuid("country_group_id")
    .notNull()
    .references(() => CountryGroupTable.id, { onDelete: "cascade" }),
  createdAt,
  updatedAt,
})

export const countryRelations = relations(CountryTable, ({ many, one }) => ({
  countryGroups: one(CountryGroupTable, {
    fields: [CountryTable.countryGroupId],
    references: [CountryGroupTable.id],
  }),
  productViews: many(ProductViewTable),
}))

export const CountryGroupTable = pgTable("country_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  recommendedDiscountPercentage: real("recommended_discount_percentage"),
  createdAt,
  updatedAt,
})

export const countryGroupRelations = relations(
  CountryGroupTable,
  ({ many }) => ({
    countries: many(CountryTable),
    countryGroupDiscounts: many(CountryGroupDiscountTable),
  })
)

export const CountryGroupDiscountTable = pgTable(
  "country_group_discounts",
  {
    countryGroupId: uuid("country_group_id")
      .notNull()
      .references(() => CountryGroupTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => ProductTable.id, { onDelete: "cascade" }),
    coupon: text("coupon").notNull(),
    discountPercentage: real("discount_percentage").notNull(),
    createdAt,
    updatedAt,
  },
  table => ({
    pk: primaryKey({ columns: [table.countryGroupId, table.productId] }),
  })
)

export const countryGroupDiscountRelations = relations(
  CountryGroupDiscountTable,
  ({ one }) => ({
    product: one(ProductTable, {
      fields: [CountryGroupDiscountTable.productId],
      references: [ProductTable.id],
    }),
    countryGroup: one(CountryGroupTable, {
      fields: [CountryGroupDiscountTable.countryGroupId],
      references: [CountryGroupTable.id],
    }),
  })
)

export const TierEnum = pgEnum(
  "tier",
  Object.keys(subscriptionTiers) as [TierNames]
)

export const UserSubscriptionTable = pgTable(
  "user_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    stripeSubscriptionItemId: text("stripe_subscription_item_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeCustomerId: text("stripe_customer_id"),
    tier: TierEnum("tier").notNull(),
    createdAt,
    updatedAt,
  },
  table => ({
    clerkUserIdIndex: index("user_subscriptions.clerk_user_id_index").on(
      table.clerkUserId
    ),
    stripeCustomerIdIndex: index(
      "user_subscriptions.stripe_customer_id_index"
    ).on(table.stripeCustomerId),
  })
)

// ----- Betting Data Tables -----

// Enums
export const BetResultEnum = pgEnum(
  "bet_result",
  ["Won", "Lost", "Push", "Pending", "Canceled"]
)

export const BetTypeEnum = pgEnum(
  "bet_type", 
  ["Single", "Parlay", "Teaser", "Round Robin"]
)

// Single bets table
export const SingleBetsTable = pgTable(
  "single_bets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    datePlaced: timestamp("date_placed", { withTimezone: true }),
    status: text("status"),
    league: text("league"),
    match: text("match"),
    betType: text("bet_type"),
    market: text("market"),
    selection: text("selection"),
    price: real("price"), 
    wager: real("wager"),
    winnings: real("winnings"),
    payout: real("payout"),
    result: text("result"),
    betSlipId: text("bet_slip_id"),
    createdAt,
    updatedAt,
  },
  table => ({
    userIdIndex: index("single_bets.user_id_index").on(table.userId),
  })
)

// Parlay headers table
export const ParlayHeadersTable = pgTable(
  "parlay_headers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    datePlaced: timestamp("date_placed", { withTimezone: true }),
    status: text("status"),
    match: text("match"), // This contains comma-separated matches
    betType: text("bet_type"),
    market: text("market"),
    selection: text("selection"),
    price: real("price"), 
    wager: real("wager"),
    winnings: real("winnings"),
    payout: real("payout"),
    potentialPayout: real("potential_payout"),
    result: text("result"),
    betSlipId: text("bet_slip_id"),
    createdAt,
    updatedAt,
  },
  table => ({
    userIdIndex: index("parlay_headers.user_id_index").on(table.userId),
    betSlipIdIndex: index("parlay_headers.bet_slip_id_index").on(table.betSlipId),
  })
)

// Parlay legs table
export const ParlayLegsTable = pgTable(
  "parlay_legs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parlayId: uuid("parlay_id").notNull().references(() => ParlayHeadersTable.id, { onDelete: "cascade" }),
    legNumber: integer("leg_number").notNull(),
    status: text("status"),
    league: text("league"),
    match: text("match"),
    market: text("market"),
    selection: text("selection"),
    price: real("price"),
    gameDate: timestamp("game_date", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  table => ({
    parlayIdIndex: index("parlay_legs.parlay_id_index").on(table.parlayId),
  })
)

// Team stats aggregation table
export const TeamStatsTable = pgTable(
  "team_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    team: text("team").notNull(),
    league: text("league"),
    totalBets: integer("total_bets").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    pushes: integer("pushes").notNull().default(0),
    pending: integer("pending").notNull().default(0),
    createdAt,
    updatedAt,
  },
  table => ({
    userIdIndex: index("team_stats.user_id_index").on(table.userId),
    teamIndex: index("team_stats.team_index").on(table.team),
  })
)

// Player stats aggregation table
export const PlayerStatsTable = pgTable(
  "player_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    player: text("player").notNull(),
    propTypes: text("prop_types").array(), // Array of prop types
    totalBets: integer("total_bets").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    pushes: integer("pushes").notNull().default(0),
    pending: integer("pending").notNull().default(0),
    createdAt,
    updatedAt,
  },
  table => ({
    userIdIndex: index("player_stats.user_id_index").on(table.userId),
    playerIndex: index("player_stats.player_index").on(table.player),
  })
)

// Prop stats aggregation table
export const PropStatsTable = pgTable(
  "prop_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    propType: text("prop_type").notNull(),
    totalBets: integer("total_bets").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    pushes: integer("pushes").notNull().default(0),
    pending: integer("pending").notNull().default(0),
    createdAt,
    updatedAt,
  },
  table => ({
    userIdIndex: index("prop_stats.user_id_index").on(table.userId),
    propTypeIndex: index("prop_stats.prop_type_index").on(table.propType),
  })
)

// Betting relations
export const parlayHeadersRelations = relations(
  ParlayHeadersTable,
  ({ many }) => ({
    legs: many(ParlayLegsTable)
  })
)

export const parlayLegsRelations = relations(
  ParlayLegsTable,
  ({ one }) => ({
    parlayHeader: one(ParlayHeadersTable, {
      fields: [ParlayLegsTable.parlayId],
      references: [ParlayHeadersTable.id],
    })
  })
)
