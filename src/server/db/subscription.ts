import { subscriptionTiers } from "@/data/subscriptionTiers"
import { db } from "@/drizzle/db"
import { UserSubscriptionTable } from "@/drizzle/schema"
import { CACHE_TAGS, dbCache, getUserTag, revalidateDbCache } from "@/lib/cache"
import { SQL } from "drizzle-orm"

export async function createUserSubscription(
  data: typeof UserSubscriptionTable.$inferInsert
) {
  const [newSubscription] = await db
    .insert(UserSubscriptionTable)
    .values(data)
    .onConflictDoNothing({
      target: UserSubscriptionTable.clerkUserId,
    })
    .returning({
      id: UserSubscriptionTable.id,
      userId: UserSubscriptionTable.clerkUserId,
    })

  if (newSubscription != null) {
    revalidateDbCache({
      tag: CACHE_TAGS.subscription,
      id: newSubscription.id,
      userId: newSubscription.userId,
    })
  }

  return newSubscription
}

export function getUserSubscription(userId: string) {
  const cacheFn = dbCache(getUserSubscriptionInternal, {
    tags: [getUserTag(userId, CACHE_TAGS.subscription)],
  })

  return cacheFn(userId)
}

export async function updateUserSubscription(
  where: SQL,
  data: Partial<typeof UserSubscriptionTable.$inferInsert>
) {
  const [updatedSubscription] = await db
    .update(UserSubscriptionTable)
    .set(data)
    .where(where)
    .returning({
      id: UserSubscriptionTable.id,
      userId: UserSubscriptionTable.clerkUserId,
    })

  if (updatedSubscription != null) {
    revalidateDbCache({
      tag: CACHE_TAGS.subscription,
      userId: updatedSubscription.userId,
      id: updatedSubscription.id,
    })
  }
}

export async function getUserSubscriptionTier(userId: string) {
  let subscription = await getUserSubscription(userId)

  // Create a default Premium subscription if none exists (for local development)
  if (subscription == null) {
    try {
      subscription = await createUserSubscription({
        clerkUserId: userId,
        tier: "Premium", // Using Premium tier for local development
      })
      
      // If for some reason the creation failed, fallback to a default Premium tier
      if (!subscription) {
        console.log("Failed to create subscription record, using default Premium tier")
        return subscriptionTiers.Premium
      }
    } catch (error) {
      console.error("Error creating subscription:", error)
      return subscriptionTiers.Premium
    }
  }

  return subscriptionTiers[subscription.tier]
}

function getUserSubscriptionInternal(userId: string) {
  return db.query.UserSubscriptionTable.findFirst({
    where: ({ clerkUserId }, { eq }) => eq(clerkUserId, userId),
  })
}
