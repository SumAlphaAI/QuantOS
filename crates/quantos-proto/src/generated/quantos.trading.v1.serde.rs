impl serde::Serialize for Fill {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if self.metadata.is_some() {
            len += 1;
        }
        if !self.fill_id.is_empty() {
            len += 1;
        }
        if !self.order_id.is_empty() {
            len += 1;
        }
        if !self.venue_fill_id.is_empty() {
            len += 1;
        }
        if !self.symbol.is_empty() {
            len += 1;
        }
        if self.quantity.is_some() {
            len += 1;
        }
        if self.price.is_some() {
            len += 1;
        }
        if self.fee.is_some() {
            len += 1;
        }
        if self.filled_at.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.trading.v1.Fill", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.fill_id.is_empty() {
            struct_ser.serialize_field("fillId", &self.fill_id)?;
        }
        if !self.order_id.is_empty() {
            struct_ser.serialize_field("orderId", &self.order_id)?;
        }
        if !self.venue_fill_id.is_empty() {
            struct_ser.serialize_field("venueFillId", &self.venue_fill_id)?;
        }
        if !self.symbol.is_empty() {
            struct_ser.serialize_field("symbol", &self.symbol)?;
        }
        if let Some(v) = self.quantity.as_ref() {
            struct_ser.serialize_field("quantity", v)?;
        }
        if let Some(v) = self.price.as_ref() {
            struct_ser.serialize_field("price", v)?;
        }
        if let Some(v) = self.fee.as_ref() {
            struct_ser.serialize_field("fee", v)?;
        }
        if let Some(v) = self.filled_at.as_ref() {
            struct_ser.serialize_field("filledAt", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for Fill {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "fill_id",
            "fillId",
            "order_id",
            "orderId",
            "venue_fill_id",
            "venueFillId",
            "symbol",
            "quantity",
            "price",
            "fee",
            "filled_at",
            "filledAt",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            FillId,
            OrderId,
            VenueFillId,
            Symbol,
            Quantity,
            Price,
            Fee,
            FilledAt,
        }
        impl<'de> serde::Deserialize<'de> for GeneratedField {
            fn deserialize<D>(deserializer: D) -> std::result::Result<GeneratedField, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                struct GeneratedVisitor;

                impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
                    type Value = GeneratedField;

                    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                        write!(formatter, "expected one of: {:?}", &FIELDS)
                    }

                    #[allow(unused_variables)]
                    fn visit_str<E>(self, value: &str) -> std::result::Result<GeneratedField, E>
                    where
                        E: serde::de::Error,
                    {
                        match value {
                            "metadata" => Ok(GeneratedField::Metadata),
                            "fillId" | "fill_id" => Ok(GeneratedField::FillId),
                            "orderId" | "order_id" => Ok(GeneratedField::OrderId),
                            "venueFillId" | "venue_fill_id" => Ok(GeneratedField::VenueFillId),
                            "symbol" => Ok(GeneratedField::Symbol),
                            "quantity" => Ok(GeneratedField::Quantity),
                            "price" => Ok(GeneratedField::Price),
                            "fee" => Ok(GeneratedField::Fee),
                            "filledAt" | "filled_at" => Ok(GeneratedField::FilledAt),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = Fill;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.trading.v1.Fill")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<Fill, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut fill_id__ = None;
                let mut order_id__ = None;
                let mut venue_fill_id__ = None;
                let mut symbol__ = None;
                let mut quantity__ = None;
                let mut price__ = None;
                let mut fee__ = None;
                let mut filled_at__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::FillId => {
                            if fill_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("fillId"));
                            }
                            fill_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::OrderId => {
                            if order_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("orderId"));
                            }
                            order_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::VenueFillId => {
                            if venue_fill_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("venueFillId"));
                            }
                            venue_fill_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Symbol => {
                            if symbol__.is_some() {
                                return Err(serde::de::Error::duplicate_field("symbol"));
                            }
                            symbol__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Quantity => {
                            if quantity__.is_some() {
                                return Err(serde::de::Error::duplicate_field("quantity"));
                            }
                            quantity__ = map_.next_value()?;
                        }
                        GeneratedField::Price => {
                            if price__.is_some() {
                                return Err(serde::de::Error::duplicate_field("price"));
                            }
                            price__ = map_.next_value()?;
                        }
                        GeneratedField::Fee => {
                            if fee__.is_some() {
                                return Err(serde::de::Error::duplicate_field("fee"));
                            }
                            fee__ = map_.next_value()?;
                        }
                        GeneratedField::FilledAt => {
                            if filled_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("filledAt"));
                            }
                            filled_at__ = map_.next_value()?;
                        }
                    }
                }
                Ok(Fill {
                    metadata: metadata__,
                    fill_id: fill_id__.unwrap_or_default(),
                    order_id: order_id__.unwrap_or_default(),
                    venue_fill_id: venue_fill_id__.unwrap_or_default(),
                    symbol: symbol__.unwrap_or_default(),
                    quantity: quantity__,
                    price: price__,
                    fee: fee__,
                    filled_at: filled_at__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.trading.v1.Fill", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for Order {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if self.metadata.is_some() {
            len += 1;
        }
        if !self.order_id.is_empty() {
            len += 1;
        }
        if !self.command_id.is_empty() {
            len += 1;
        }
        if !self.venue_order_id.is_empty() {
            len += 1;
        }
        if !self.account_id.is_empty() {
            len += 1;
        }
        if !self.symbol.is_empty() {
            len += 1;
        }
        if self.side != 0 {
            len += 1;
        }
        if self.intent != 0 {
            len += 1;
        }
        if self.quantity.is_some() {
            len += 1;
        }
        if self.filled_quantity.is_some() {
            len += 1;
        }
        if self.average_fill_price.is_some() {
            len += 1;
        }
        if self.status != 0 {
            len += 1;
        }
        if self.submitted_at.is_some() {
            len += 1;
        }
        if self.updated_at.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.trading.v1.Order", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.order_id.is_empty() {
            struct_ser.serialize_field("orderId", &self.order_id)?;
        }
        if !self.command_id.is_empty() {
            struct_ser.serialize_field("commandId", &self.command_id)?;
        }
        if !self.venue_order_id.is_empty() {
            struct_ser.serialize_field("venueOrderId", &self.venue_order_id)?;
        }
        if !self.account_id.is_empty() {
            struct_ser.serialize_field("accountId", &self.account_id)?;
        }
        if !self.symbol.is_empty() {
            struct_ser.serialize_field("symbol", &self.symbol)?;
        }
        if self.side != 0 {
            let v = crate::protojson::enum_value::<OrderSide>(self.side).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("side", &v)?;
        }
        if self.intent != 0 {
            let v = crate::protojson::enum_value::<OrderIntentType>(self.intent).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("intent", &v)?;
        }
        if let Some(v) = self.quantity.as_ref() {
            struct_ser.serialize_field("quantity", v)?;
        }
        if let Some(v) = self.filled_quantity.as_ref() {
            struct_ser.serialize_field("filledQuantity", v)?;
        }
        if let Some(v) = self.average_fill_price.as_ref() {
            struct_ser.serialize_field("averageFillPrice", v)?;
        }
        if self.status != 0 {
            let v = crate::protojson::enum_value::<OrderStatus>(self.status).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("status", &v)?;
        }
        if let Some(v) = self.submitted_at.as_ref() {
            struct_ser.serialize_field("submittedAt", v)?;
        }
        if let Some(v) = self.updated_at.as_ref() {
            struct_ser.serialize_field("updatedAt", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for Order {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "order_id",
            "orderId",
            "command_id",
            "commandId",
            "venue_order_id",
            "venueOrderId",
            "account_id",
            "accountId",
            "symbol",
            "side",
            "intent",
            "quantity",
            "filled_quantity",
            "filledQuantity",
            "average_fill_price",
            "averageFillPrice",
            "status",
            "submitted_at",
            "submittedAt",
            "updated_at",
            "updatedAt",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            OrderId,
            CommandId,
            VenueOrderId,
            AccountId,
            Symbol,
            Side,
            Intent,
            Quantity,
            FilledQuantity,
            AverageFillPrice,
            Status,
            SubmittedAt,
            UpdatedAt,
        }
        impl<'de> serde::Deserialize<'de> for GeneratedField {
            fn deserialize<D>(deserializer: D) -> std::result::Result<GeneratedField, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                struct GeneratedVisitor;

                impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
                    type Value = GeneratedField;

                    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                        write!(formatter, "expected one of: {:?}", &FIELDS)
                    }

                    #[allow(unused_variables)]
                    fn visit_str<E>(self, value: &str) -> std::result::Result<GeneratedField, E>
                    where
                        E: serde::de::Error,
                    {
                        match value {
                            "metadata" => Ok(GeneratedField::Metadata),
                            "orderId" | "order_id" => Ok(GeneratedField::OrderId),
                            "commandId" | "command_id" => Ok(GeneratedField::CommandId),
                            "venueOrderId" | "venue_order_id" => Ok(GeneratedField::VenueOrderId),
                            "accountId" | "account_id" => Ok(GeneratedField::AccountId),
                            "symbol" => Ok(GeneratedField::Symbol),
                            "side" => Ok(GeneratedField::Side),
                            "intent" => Ok(GeneratedField::Intent),
                            "quantity" => Ok(GeneratedField::Quantity),
                            "filledQuantity" | "filled_quantity" => Ok(GeneratedField::FilledQuantity),
                            "averageFillPrice" | "average_fill_price" => Ok(GeneratedField::AverageFillPrice),
                            "status" => Ok(GeneratedField::Status),
                            "submittedAt" | "submitted_at" => Ok(GeneratedField::SubmittedAt),
                            "updatedAt" | "updated_at" => Ok(GeneratedField::UpdatedAt),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = Order;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.trading.v1.Order")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<Order, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut order_id__ = None;
                let mut command_id__ = None;
                let mut venue_order_id__ = None;
                let mut account_id__ = None;
                let mut symbol__ = None;
                let mut side__ = None;
                let mut intent__ = None;
                let mut quantity__ = None;
                let mut filled_quantity__ = None;
                let mut average_fill_price__ = None;
                let mut status__ = None;
                let mut submitted_at__ = None;
                let mut updated_at__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::OrderId => {
                            if order_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("orderId"));
                            }
                            order_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::CommandId => {
                            if command_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("commandId"));
                            }
                            command_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::VenueOrderId => {
                            if venue_order_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("venueOrderId"));
                            }
                            venue_order_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::AccountId => {
                            if account_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("accountId"));
                            }
                            account_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Symbol => {
                            if symbol__.is_some() {
                                return Err(serde::de::Error::duplicate_field("symbol"));
                            }
                            symbol__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Side => {
                            if side__.is_some() {
                                return Err(serde::de::Error::duplicate_field("side"));
                            }
                            side__ = Some(map_.next_value::<crate::protojson::OpenEnum<OrderSide>>()?.value);
                        }
                        GeneratedField::Intent => {
                            if intent__.is_some() {
                                return Err(serde::de::Error::duplicate_field("intent"));
                            }
                            intent__ = Some(map_.next_value::<crate::protojson::OpenEnum<OrderIntentType>>()?.value);
                        }
                        GeneratedField::Quantity => {
                            if quantity__.is_some() {
                                return Err(serde::de::Error::duplicate_field("quantity"));
                            }
                            quantity__ = map_.next_value()?;
                        }
                        GeneratedField::FilledQuantity => {
                            if filled_quantity__.is_some() {
                                return Err(serde::de::Error::duplicate_field("filledQuantity"));
                            }
                            filled_quantity__ = map_.next_value()?;
                        }
                        GeneratedField::AverageFillPrice => {
                            if average_fill_price__.is_some() {
                                return Err(serde::de::Error::duplicate_field("averageFillPrice"));
                            }
                            average_fill_price__ = map_.next_value()?;
                        }
                        GeneratedField::Status => {
                            if status__.is_some() {
                                return Err(serde::de::Error::duplicate_field("status"));
                            }
                            status__ = Some(map_.next_value::<crate::protojson::OpenEnum<OrderStatus>>()?.value);
                        }
                        GeneratedField::SubmittedAt => {
                            if submitted_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("submittedAt"));
                            }
                            submitted_at__ = map_.next_value()?;
                        }
                        GeneratedField::UpdatedAt => {
                            if updated_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("updatedAt"));
                            }
                            updated_at__ = map_.next_value()?;
                        }
                    }
                }
                Ok(Order {
                    metadata: metadata__,
                    order_id: order_id__.unwrap_or_default(),
                    command_id: command_id__.unwrap_or_default(),
                    venue_order_id: venue_order_id__.unwrap_or_default(),
                    account_id: account_id__.unwrap_or_default(),
                    symbol: symbol__.unwrap_or_default(),
                    side: side__.unwrap_or_default(),
                    intent: intent__.unwrap_or_default(),
                    quantity: quantity__,
                    filled_quantity: filled_quantity__,
                    average_fill_price: average_fill_price__,
                    status: status__.unwrap_or_default(),
                    submitted_at: submitted_at__,
                    updated_at: updated_at__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.trading.v1.Order", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for OrderIntentType {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "ORDER_INTENT_TYPE_UNSPECIFIED",
            Self::Market => "ORDER_INTENT_TYPE_MARKET",
            Self::Limit => "ORDER_INTENT_TYPE_LIMIT",
            Self::Stop => "ORDER_INTENT_TYPE_STOP",
            Self::StopLimit => "ORDER_INTENT_TYPE_STOP_LIMIT",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for OrderIntentType {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "ORDER_INTENT_TYPE_UNSPECIFIED",
            "ORDER_INTENT_TYPE_MARKET",
            "ORDER_INTENT_TYPE_LIMIT",
            "ORDER_INTENT_TYPE_STOP",
            "ORDER_INTENT_TYPE_STOP_LIMIT",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = OrderIntentType;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(formatter, "expected one of: {:?}", &FIELDS)
            }

            fn visit_i64<E>(self, v: i64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Signed(v), &self)
                    })
            }

            fn visit_u64<E>(self, v: u64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Unsigned(v), &self)
                    })
            }

            fn visit_str<E>(self, value: &str) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                match value {
                    "ORDER_INTENT_TYPE_UNSPECIFIED" => Ok(OrderIntentType::Unspecified),
                    "ORDER_INTENT_TYPE_MARKET" => Ok(OrderIntentType::Market),
                    "ORDER_INTENT_TYPE_LIMIT" => Ok(OrderIntentType::Limit),
                    "ORDER_INTENT_TYPE_STOP" => Ok(OrderIntentType::Stop),
                    "ORDER_INTENT_TYPE_STOP_LIMIT" => Ok(OrderIntentType::StopLimit),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
impl serde::Serialize for OrderSide {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "ORDER_SIDE_UNSPECIFIED",
            Self::Buy => "ORDER_SIDE_BUY",
            Self::Sell => "ORDER_SIDE_SELL",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for OrderSide {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "ORDER_SIDE_UNSPECIFIED",
            "ORDER_SIDE_BUY",
            "ORDER_SIDE_SELL",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = OrderSide;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(formatter, "expected one of: {:?}", &FIELDS)
            }

            fn visit_i64<E>(self, v: i64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Signed(v), &self)
                    })
            }

            fn visit_u64<E>(self, v: u64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Unsigned(v), &self)
                    })
            }

            fn visit_str<E>(self, value: &str) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                match value {
                    "ORDER_SIDE_UNSPECIFIED" => Ok(OrderSide::Unspecified),
                    "ORDER_SIDE_BUY" => Ok(OrderSide::Buy),
                    "ORDER_SIDE_SELL" => Ok(OrderSide::Sell),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
impl serde::Serialize for OrderStatus {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "ORDER_STATUS_UNSPECIFIED",
            Self::Draft => "ORDER_STATUS_DRAFT",
            Self::Submitted => "ORDER_STATUS_SUBMITTED",
            Self::Accepted => "ORDER_STATUS_ACCEPTED",
            Self::Rejected => "ORDER_STATUS_REJECTED",
            Self::PartiallyFilled => "ORDER_STATUS_PARTIALLY_FILLED",
            Self::Filled => "ORDER_STATUS_FILLED",
            Self::Cancelled => "ORDER_STATUS_CANCELLED",
            Self::Expired => "ORDER_STATUS_EXPIRED",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for OrderStatus {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "ORDER_STATUS_UNSPECIFIED",
            "ORDER_STATUS_DRAFT",
            "ORDER_STATUS_SUBMITTED",
            "ORDER_STATUS_ACCEPTED",
            "ORDER_STATUS_REJECTED",
            "ORDER_STATUS_PARTIALLY_FILLED",
            "ORDER_STATUS_FILLED",
            "ORDER_STATUS_CANCELLED",
            "ORDER_STATUS_EXPIRED",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = OrderStatus;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(formatter, "expected one of: {:?}", &FIELDS)
            }

            fn visit_i64<E>(self, v: i64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Signed(v), &self)
                    })
            }

            fn visit_u64<E>(self, v: u64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Unsigned(v), &self)
                    })
            }

            fn visit_str<E>(self, value: &str) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                match value {
                    "ORDER_STATUS_UNSPECIFIED" => Ok(OrderStatus::Unspecified),
                    "ORDER_STATUS_DRAFT" => Ok(OrderStatus::Draft),
                    "ORDER_STATUS_SUBMITTED" => Ok(OrderStatus::Submitted),
                    "ORDER_STATUS_ACCEPTED" => Ok(OrderStatus::Accepted),
                    "ORDER_STATUS_REJECTED" => Ok(OrderStatus::Rejected),
                    "ORDER_STATUS_PARTIALLY_FILLED" => Ok(OrderStatus::PartiallyFilled),
                    "ORDER_STATUS_FILLED" => Ok(OrderStatus::Filled),
                    "ORDER_STATUS_CANCELLED" => Ok(OrderStatus::Cancelled),
                    "ORDER_STATUS_EXPIRED" => Ok(OrderStatus::Expired),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
impl serde::Serialize for Position {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if self.metadata.is_some() {
            len += 1;
        }
        if !self.position_id.is_empty() {
            len += 1;
        }
        if !self.account_id.is_empty() {
            len += 1;
        }
        if !self.symbol.is_empty() {
            len += 1;
        }
        if self.side != 0 {
            len += 1;
        }
        if self.quantity.is_some() {
            len += 1;
        }
        if self.average_entry_price.is_some() {
            len += 1;
        }
        if self.mark_value.is_some() {
            len += 1;
        }
        if self.unrealized_pnl.is_some() {
            len += 1;
        }
        if self.as_of.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.trading.v1.Position", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.position_id.is_empty() {
            struct_ser.serialize_field("positionId", &self.position_id)?;
        }
        if !self.account_id.is_empty() {
            struct_ser.serialize_field("accountId", &self.account_id)?;
        }
        if !self.symbol.is_empty() {
            struct_ser.serialize_field("symbol", &self.symbol)?;
        }
        if self.side != 0 {
            let v = crate::protojson::enum_value::<PositionSide>(self.side).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("side", &v)?;
        }
        if let Some(v) = self.quantity.as_ref() {
            struct_ser.serialize_field("quantity", v)?;
        }
        if let Some(v) = self.average_entry_price.as_ref() {
            struct_ser.serialize_field("averageEntryPrice", v)?;
        }
        if let Some(v) = self.mark_value.as_ref() {
            struct_ser.serialize_field("markValue", v)?;
        }
        if let Some(v) = self.unrealized_pnl.as_ref() {
            struct_ser.serialize_field("unrealizedPnl", v)?;
        }
        if let Some(v) = self.as_of.as_ref() {
            struct_ser.serialize_field("asOf", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for Position {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "position_id",
            "positionId",
            "account_id",
            "accountId",
            "symbol",
            "side",
            "quantity",
            "average_entry_price",
            "averageEntryPrice",
            "mark_value",
            "markValue",
            "unrealized_pnl",
            "unrealizedPnl",
            "as_of",
            "asOf",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            PositionId,
            AccountId,
            Symbol,
            Side,
            Quantity,
            AverageEntryPrice,
            MarkValue,
            UnrealizedPnl,
            AsOf,
        }
        impl<'de> serde::Deserialize<'de> for GeneratedField {
            fn deserialize<D>(deserializer: D) -> std::result::Result<GeneratedField, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                struct GeneratedVisitor;

                impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
                    type Value = GeneratedField;

                    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                        write!(formatter, "expected one of: {:?}", &FIELDS)
                    }

                    #[allow(unused_variables)]
                    fn visit_str<E>(self, value: &str) -> std::result::Result<GeneratedField, E>
                    where
                        E: serde::de::Error,
                    {
                        match value {
                            "metadata" => Ok(GeneratedField::Metadata),
                            "positionId" | "position_id" => Ok(GeneratedField::PositionId),
                            "accountId" | "account_id" => Ok(GeneratedField::AccountId),
                            "symbol" => Ok(GeneratedField::Symbol),
                            "side" => Ok(GeneratedField::Side),
                            "quantity" => Ok(GeneratedField::Quantity),
                            "averageEntryPrice" | "average_entry_price" => Ok(GeneratedField::AverageEntryPrice),
                            "markValue" | "mark_value" => Ok(GeneratedField::MarkValue),
                            "unrealizedPnl" | "unrealized_pnl" => Ok(GeneratedField::UnrealizedPnl),
                            "asOf" | "as_of" => Ok(GeneratedField::AsOf),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = Position;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.trading.v1.Position")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<Position, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut position_id__ = None;
                let mut account_id__ = None;
                let mut symbol__ = None;
                let mut side__ = None;
                let mut quantity__ = None;
                let mut average_entry_price__ = None;
                let mut mark_value__ = None;
                let mut unrealized_pnl__ = None;
                let mut as_of__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::PositionId => {
                            if position_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("positionId"));
                            }
                            position_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::AccountId => {
                            if account_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("accountId"));
                            }
                            account_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Symbol => {
                            if symbol__.is_some() {
                                return Err(serde::de::Error::duplicate_field("symbol"));
                            }
                            symbol__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Side => {
                            if side__.is_some() {
                                return Err(serde::de::Error::duplicate_field("side"));
                            }
                            side__ = Some(map_.next_value::<crate::protojson::OpenEnum<PositionSide>>()?.value);
                        }
                        GeneratedField::Quantity => {
                            if quantity__.is_some() {
                                return Err(serde::de::Error::duplicate_field("quantity"));
                            }
                            quantity__ = map_.next_value()?;
                        }
                        GeneratedField::AverageEntryPrice => {
                            if average_entry_price__.is_some() {
                                return Err(serde::de::Error::duplicate_field("averageEntryPrice"));
                            }
                            average_entry_price__ = map_.next_value()?;
                        }
                        GeneratedField::MarkValue => {
                            if mark_value__.is_some() {
                                return Err(serde::de::Error::duplicate_field("markValue"));
                            }
                            mark_value__ = map_.next_value()?;
                        }
                        GeneratedField::UnrealizedPnl => {
                            if unrealized_pnl__.is_some() {
                                return Err(serde::de::Error::duplicate_field("unrealizedPnl"));
                            }
                            unrealized_pnl__ = map_.next_value()?;
                        }
                        GeneratedField::AsOf => {
                            if as_of__.is_some() {
                                return Err(serde::de::Error::duplicate_field("asOf"));
                            }
                            as_of__ = map_.next_value()?;
                        }
                    }
                }
                Ok(Position {
                    metadata: metadata__,
                    position_id: position_id__.unwrap_or_default(),
                    account_id: account_id__.unwrap_or_default(),
                    symbol: symbol__.unwrap_or_default(),
                    side: side__.unwrap_or_default(),
                    quantity: quantity__,
                    average_entry_price: average_entry_price__,
                    mark_value: mark_value__,
                    unrealized_pnl: unrealized_pnl__,
                    as_of: as_of__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.trading.v1.Position", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for PositionSide {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "POSITION_SIDE_UNSPECIFIED",
            Self::Net => "POSITION_SIDE_NET",
            Self::Long => "POSITION_SIDE_LONG",
            Self::Short => "POSITION_SIDE_SHORT",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for PositionSide {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "POSITION_SIDE_UNSPECIFIED",
            "POSITION_SIDE_NET",
            "POSITION_SIDE_LONG",
            "POSITION_SIDE_SHORT",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = PositionSide;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(formatter, "expected one of: {:?}", &FIELDS)
            }

            fn visit_i64<E>(self, v: i64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Signed(v), &self)
                    })
            }

            fn visit_u64<E>(self, v: u64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Unsigned(v), &self)
                    })
            }

            fn visit_str<E>(self, value: &str) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                match value {
                    "POSITION_SIDE_UNSPECIFIED" => Ok(PositionSide::Unspecified),
                    "POSITION_SIDE_NET" => Ok(PositionSide::Net),
                    "POSITION_SIDE_LONG" => Ok(PositionSide::Long),
                    "POSITION_SIDE_SHORT" => Ok(PositionSide::Short),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
impl serde::Serialize for ProposalAction {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "PROPOSAL_ACTION_UNSPECIFIED",
            Self::Buy => "PROPOSAL_ACTION_BUY",
            Self::Sell => "PROPOSAL_ACTION_SELL",
            Self::Hold => "PROPOSAL_ACTION_HOLD",
            Self::Reduce => "PROPOSAL_ACTION_REDUCE",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for ProposalAction {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "PROPOSAL_ACTION_UNSPECIFIED",
            "PROPOSAL_ACTION_BUY",
            "PROPOSAL_ACTION_SELL",
            "PROPOSAL_ACTION_HOLD",
            "PROPOSAL_ACTION_REDUCE",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = ProposalAction;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(formatter, "expected one of: {:?}", &FIELDS)
            }

            fn visit_i64<E>(self, v: i64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Signed(v), &self)
                    })
            }

            fn visit_u64<E>(self, v: u64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Unsigned(v), &self)
                    })
            }

            fn visit_str<E>(self, value: &str) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                match value {
                    "PROPOSAL_ACTION_UNSPECIFIED" => Ok(ProposalAction::Unspecified),
                    "PROPOSAL_ACTION_BUY" => Ok(ProposalAction::Buy),
                    "PROPOSAL_ACTION_SELL" => Ok(ProposalAction::Sell),
                    "PROPOSAL_ACTION_HOLD" => Ok(ProposalAction::Hold),
                    "PROPOSAL_ACTION_REDUCE" => Ok(ProposalAction::Reduce),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
impl serde::Serialize for RiskDecision {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if self.metadata.is_some() {
            len += 1;
        }
        if !self.decision_id.is_empty() {
            len += 1;
        }
        if !self.proposal_id.is_empty() {
            len += 1;
        }
        if self.verdict != 0 {
            len += 1;
        }
        if !self.hit_rules.is_empty() {
            len += 1;
        }
        if !self.limit_ids.is_empty() {
            len += 1;
        }
        if !self.signer.is_empty() {
            len += 1;
        }
        if !self.reason.is_empty() {
            len += 1;
        }
        if self.decided_at.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.trading.v1.RiskDecision", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.decision_id.is_empty() {
            struct_ser.serialize_field("decisionId", &self.decision_id)?;
        }
        if !self.proposal_id.is_empty() {
            struct_ser.serialize_field("proposalId", &self.proposal_id)?;
        }
        if self.verdict != 0 {
            let v = crate::protojson::enum_value::<RiskVerdict>(self.verdict).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("verdict", &v)?;
        }
        if !self.hit_rules.is_empty() {
            struct_ser.serialize_field("hitRules", &self.hit_rules)?;
        }
        if !self.limit_ids.is_empty() {
            struct_ser.serialize_field("limitIds", &self.limit_ids)?;
        }
        if !self.signer.is_empty() {
            struct_ser.serialize_field("signer", &self.signer)?;
        }
        if !self.reason.is_empty() {
            struct_ser.serialize_field("reason", &self.reason)?;
        }
        if let Some(v) = self.decided_at.as_ref() {
            struct_ser.serialize_field("decidedAt", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for RiskDecision {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "decision_id",
            "decisionId",
            "proposal_id",
            "proposalId",
            "verdict",
            "hit_rules",
            "hitRules",
            "limit_ids",
            "limitIds",
            "signer",
            "reason",
            "decided_at",
            "decidedAt",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            DecisionId,
            ProposalId,
            Verdict,
            HitRules,
            LimitIds,
            Signer,
            Reason,
            DecidedAt,
        }
        impl<'de> serde::Deserialize<'de> for GeneratedField {
            fn deserialize<D>(deserializer: D) -> std::result::Result<GeneratedField, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                struct GeneratedVisitor;

                impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
                    type Value = GeneratedField;

                    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                        write!(formatter, "expected one of: {:?}", &FIELDS)
                    }

                    #[allow(unused_variables)]
                    fn visit_str<E>(self, value: &str) -> std::result::Result<GeneratedField, E>
                    where
                        E: serde::de::Error,
                    {
                        match value {
                            "metadata" => Ok(GeneratedField::Metadata),
                            "decisionId" | "decision_id" => Ok(GeneratedField::DecisionId),
                            "proposalId" | "proposal_id" => Ok(GeneratedField::ProposalId),
                            "verdict" => Ok(GeneratedField::Verdict),
                            "hitRules" | "hit_rules" => Ok(GeneratedField::HitRules),
                            "limitIds" | "limit_ids" => Ok(GeneratedField::LimitIds),
                            "signer" => Ok(GeneratedField::Signer),
                            "reason" => Ok(GeneratedField::Reason),
                            "decidedAt" | "decided_at" => Ok(GeneratedField::DecidedAt),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = RiskDecision;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.trading.v1.RiskDecision")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<RiskDecision, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut decision_id__ = None;
                let mut proposal_id__ = None;
                let mut verdict__ = None;
                let mut hit_rules__ = None;
                let mut limit_ids__ = None;
                let mut signer__ = None;
                let mut reason__ = None;
                let mut decided_at__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::DecisionId => {
                            if decision_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("decisionId"));
                            }
                            decision_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::ProposalId => {
                            if proposal_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("proposalId"));
                            }
                            proposal_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Verdict => {
                            if verdict__.is_some() {
                                return Err(serde::de::Error::duplicate_field("verdict"));
                            }
                            verdict__ = Some(map_.next_value::<crate::protojson::OpenEnum<RiskVerdict>>()?.value);
                        }
                        GeneratedField::HitRules => {
                            if hit_rules__.is_some() {
                                return Err(serde::de::Error::duplicate_field("hitRules"));
                            }
                            hit_rules__ = Some(map_.next_value()?);
                        }
                        GeneratedField::LimitIds => {
                            if limit_ids__.is_some() {
                                return Err(serde::de::Error::duplicate_field("limitIds"));
                            }
                            limit_ids__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Signer => {
                            if signer__.is_some() {
                                return Err(serde::de::Error::duplicate_field("signer"));
                            }
                            signer__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Reason => {
                            if reason__.is_some() {
                                return Err(serde::de::Error::duplicate_field("reason"));
                            }
                            reason__ = Some(map_.next_value()?);
                        }
                        GeneratedField::DecidedAt => {
                            if decided_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("decidedAt"));
                            }
                            decided_at__ = map_.next_value()?;
                        }
                    }
                }
                Ok(RiskDecision {
                    metadata: metadata__,
                    decision_id: decision_id__.unwrap_or_default(),
                    proposal_id: proposal_id__.unwrap_or_default(),
                    verdict: verdict__.unwrap_or_default(),
                    hit_rules: hit_rules__.unwrap_or_default(),
                    limit_ids: limit_ids__.unwrap_or_default(),
                    signer: signer__.unwrap_or_default(),
                    reason: reason__.unwrap_or_default(),
                    decided_at: decided_at__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.trading.v1.RiskDecision", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for RiskVerdict {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "RISK_VERDICT_UNSPECIFIED",
            Self::Allow => "RISK_VERDICT_ALLOW",
            Self::Deny => "RISK_VERDICT_DENY",
            Self::ApprovalRequired => "RISK_VERDICT_APPROVAL_REQUIRED",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for RiskVerdict {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "RISK_VERDICT_UNSPECIFIED",
            "RISK_VERDICT_ALLOW",
            "RISK_VERDICT_DENY",
            "RISK_VERDICT_APPROVAL_REQUIRED",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = RiskVerdict;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(formatter, "expected one of: {:?}", &FIELDS)
            }

            fn visit_i64<E>(self, v: i64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Signed(v), &self)
                    })
            }

            fn visit_u64<E>(self, v: u64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Unsigned(v), &self)
                    })
            }

            fn visit_str<E>(self, value: &str) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                match value {
                    "RISK_VERDICT_UNSPECIFIED" => Ok(RiskVerdict::Unspecified),
                    "RISK_VERDICT_ALLOW" => Ok(RiskVerdict::Allow),
                    "RISK_VERDICT_DENY" => Ok(RiskVerdict::Deny),
                    "RISK_VERDICT_APPROVAL_REQUIRED" => Ok(RiskVerdict::ApprovalRequired),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
impl serde::Serialize for TradeCommand {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if self.metadata.is_some() {
            len += 1;
        }
        if !self.command_id.is_empty() {
            len += 1;
        }
        if !self.decision_id.is_empty() {
            len += 1;
        }
        if !self.account_id.is_empty() {
            len += 1;
        }
        if !self.venue.is_empty() {
            len += 1;
        }
        if self.venue_kind != 0 {
            len += 1;
        }
        if !self.symbol.is_empty() {
            len += 1;
        }
        if self.intent != 0 {
            len += 1;
        }
        if self.side != 0 {
            len += 1;
        }
        if self.quantity.is_some() {
            len += 1;
        }
        if self.limit_price.is_some() {
            len += 1;
        }
        if self.stop_price.is_some() {
            len += 1;
        }
        if !self.idempotency_key.is_empty() {
            len += 1;
        }
        if !self.approval_signature.is_empty() {
            len += 1;
        }
        if self.expires_at.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.trading.v1.TradeCommand", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.command_id.is_empty() {
            struct_ser.serialize_field("commandId", &self.command_id)?;
        }
        if !self.decision_id.is_empty() {
            struct_ser.serialize_field("decisionId", &self.decision_id)?;
        }
        if !self.account_id.is_empty() {
            struct_ser.serialize_field("accountId", &self.account_id)?;
        }
        if !self.venue.is_empty() {
            struct_ser.serialize_field("venue", &self.venue)?;
        }
        if self.venue_kind != 0 {
            let v = crate::protojson::enum_value::<VenueKind>(self.venue_kind).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("venueKind", &v)?;
        }
        if !self.symbol.is_empty() {
            struct_ser.serialize_field("symbol", &self.symbol)?;
        }
        if self.intent != 0 {
            let v = crate::protojson::enum_value::<OrderIntentType>(self.intent).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("intent", &v)?;
        }
        if self.side != 0 {
            let v = crate::protojson::enum_value::<OrderSide>(self.side).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("side", &v)?;
        }
        if let Some(v) = self.quantity.as_ref() {
            struct_ser.serialize_field("quantity", v)?;
        }
        if let Some(v) = self.limit_price.as_ref() {
            struct_ser.serialize_field("limitPrice", v)?;
        }
        if let Some(v) = self.stop_price.as_ref() {
            struct_ser.serialize_field("stopPrice", v)?;
        }
        if !self.idempotency_key.is_empty() {
            struct_ser.serialize_field("idempotencyKey", &self.idempotency_key)?;
        }
        if !self.approval_signature.is_empty() {
            struct_ser.serialize_field("approvalSignature", &self.approval_signature)?;
        }
        if let Some(v) = self.expires_at.as_ref() {
            struct_ser.serialize_field("expiresAt", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for TradeCommand {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "command_id",
            "commandId",
            "decision_id",
            "decisionId",
            "account_id",
            "accountId",
            "venue",
            "venue_kind",
            "venueKind",
            "symbol",
            "intent",
            "side",
            "quantity",
            "limit_price",
            "limitPrice",
            "stop_price",
            "stopPrice",
            "idempotency_key",
            "idempotencyKey",
            "approval_signature",
            "approvalSignature",
            "expires_at",
            "expiresAt",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            CommandId,
            DecisionId,
            AccountId,
            Venue,
            VenueKind,
            Symbol,
            Intent,
            Side,
            Quantity,
            LimitPrice,
            StopPrice,
            IdempotencyKey,
            ApprovalSignature,
            ExpiresAt,
        }
        impl<'de> serde::Deserialize<'de> for GeneratedField {
            fn deserialize<D>(deserializer: D) -> std::result::Result<GeneratedField, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                struct GeneratedVisitor;

                impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
                    type Value = GeneratedField;

                    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                        write!(formatter, "expected one of: {:?}", &FIELDS)
                    }

                    #[allow(unused_variables)]
                    fn visit_str<E>(self, value: &str) -> std::result::Result<GeneratedField, E>
                    where
                        E: serde::de::Error,
                    {
                        match value {
                            "metadata" => Ok(GeneratedField::Metadata),
                            "commandId" | "command_id" => Ok(GeneratedField::CommandId),
                            "decisionId" | "decision_id" => Ok(GeneratedField::DecisionId),
                            "accountId" | "account_id" => Ok(GeneratedField::AccountId),
                            "venue" => Ok(GeneratedField::Venue),
                            "venueKind" | "venue_kind" => Ok(GeneratedField::VenueKind),
                            "symbol" => Ok(GeneratedField::Symbol),
                            "intent" => Ok(GeneratedField::Intent),
                            "side" => Ok(GeneratedField::Side),
                            "quantity" => Ok(GeneratedField::Quantity),
                            "limitPrice" | "limit_price" => Ok(GeneratedField::LimitPrice),
                            "stopPrice" | "stop_price" => Ok(GeneratedField::StopPrice),
                            "idempotencyKey" | "idempotency_key" => Ok(GeneratedField::IdempotencyKey),
                            "approvalSignature" | "approval_signature" => Ok(GeneratedField::ApprovalSignature),
                            "expiresAt" | "expires_at" => Ok(GeneratedField::ExpiresAt),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = TradeCommand;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.trading.v1.TradeCommand")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<TradeCommand, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut command_id__ = None;
                let mut decision_id__ = None;
                let mut account_id__ = None;
                let mut venue__ = None;
                let mut venue_kind__ = None;
                let mut symbol__ = None;
                let mut intent__ = None;
                let mut side__ = None;
                let mut quantity__ = None;
                let mut limit_price__ = None;
                let mut stop_price__ = None;
                let mut idempotency_key__ = None;
                let mut approval_signature__ = None;
                let mut expires_at__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::CommandId => {
                            if command_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("commandId"));
                            }
                            command_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::DecisionId => {
                            if decision_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("decisionId"));
                            }
                            decision_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::AccountId => {
                            if account_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("accountId"));
                            }
                            account_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Venue => {
                            if venue__.is_some() {
                                return Err(serde::de::Error::duplicate_field("venue"));
                            }
                            venue__ = Some(map_.next_value()?);
                        }
                        GeneratedField::VenueKind => {
                            if venue_kind__.is_some() {
                                return Err(serde::de::Error::duplicate_field("venueKind"));
                            }
                            venue_kind__ = Some(map_.next_value::<crate::protojson::OpenEnum<VenueKind>>()?.value);
                        }
                        GeneratedField::Symbol => {
                            if symbol__.is_some() {
                                return Err(serde::de::Error::duplicate_field("symbol"));
                            }
                            symbol__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Intent => {
                            if intent__.is_some() {
                                return Err(serde::de::Error::duplicate_field("intent"));
                            }
                            intent__ = Some(map_.next_value::<crate::protojson::OpenEnum<OrderIntentType>>()?.value);
                        }
                        GeneratedField::Side => {
                            if side__.is_some() {
                                return Err(serde::de::Error::duplicate_field("side"));
                            }
                            side__ = Some(map_.next_value::<crate::protojson::OpenEnum<OrderSide>>()?.value);
                        }
                        GeneratedField::Quantity => {
                            if quantity__.is_some() {
                                return Err(serde::de::Error::duplicate_field("quantity"));
                            }
                            quantity__ = map_.next_value()?;
                        }
                        GeneratedField::LimitPrice => {
                            if limit_price__.is_some() {
                                return Err(serde::de::Error::duplicate_field("limitPrice"));
                            }
                            limit_price__ = map_.next_value()?;
                        }
                        GeneratedField::StopPrice => {
                            if stop_price__.is_some() {
                                return Err(serde::de::Error::duplicate_field("stopPrice"));
                            }
                            stop_price__ = map_.next_value()?;
                        }
                        GeneratedField::IdempotencyKey => {
                            if idempotency_key__.is_some() {
                                return Err(serde::de::Error::duplicate_field("idempotencyKey"));
                            }
                            idempotency_key__ = Some(map_.next_value()?);
                        }
                        GeneratedField::ApprovalSignature => {
                            if approval_signature__.is_some() {
                                return Err(serde::de::Error::duplicate_field("approvalSignature"));
                            }
                            approval_signature__ = Some(map_.next_value()?);
                        }
                        GeneratedField::ExpiresAt => {
                            if expires_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("expiresAt"));
                            }
                            expires_at__ = map_.next_value()?;
                        }
                    }
                }
                Ok(TradeCommand {
                    metadata: metadata__,
                    command_id: command_id__.unwrap_or_default(),
                    decision_id: decision_id__.unwrap_or_default(),
                    account_id: account_id__.unwrap_or_default(),
                    venue: venue__.unwrap_or_default(),
                    venue_kind: venue_kind__.unwrap_or_default(),
                    symbol: symbol__.unwrap_or_default(),
                    intent: intent__.unwrap_or_default(),
                    side: side__.unwrap_or_default(),
                    quantity: quantity__,
                    limit_price: limit_price__,
                    stop_price: stop_price__,
                    idempotency_key: idempotency_key__.unwrap_or_default(),
                    approval_signature: approval_signature__.unwrap_or_default(),
                    expires_at: expires_at__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.trading.v1.TradeCommand", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for TradeProposal {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if self.metadata.is_some() {
            len += 1;
        }
        if !self.proposal_id.is_empty() {
            len += 1;
        }
        if !self.account_id.is_empty() {
            len += 1;
        }
        if !self.symbol.is_empty() {
            len += 1;
        }
        if self.action != 0 {
            len += 1;
        }
        if self.quantity.is_some() {
            len += 1;
        }
        if self.notional.is_some() {
            len += 1;
        }
        if self.limit_price.is_some() {
            len += 1;
        }
        if self.stop_price.is_some() {
            len += 1;
        }
        if self.signal.is_some() {
            len += 1;
        }
        if !self.evidence_refs.is_empty() {
            len += 1;
        }
        if !self.rationale.is_empty() {
            len += 1;
        }
        if self.confidence.is_some() {
            len += 1;
        }
        if self.expires_at.is_some() {
            len += 1;
        }
        if self.executable {
            len += 1;
        }
        if !self.counter_views.is_empty() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.trading.v1.TradeProposal", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.proposal_id.is_empty() {
            struct_ser.serialize_field("proposalId", &self.proposal_id)?;
        }
        if !self.account_id.is_empty() {
            struct_ser.serialize_field("accountId", &self.account_id)?;
        }
        if !self.symbol.is_empty() {
            struct_ser.serialize_field("symbol", &self.symbol)?;
        }
        if self.action != 0 {
            let v = crate::protojson::enum_value::<ProposalAction>(self.action).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("action", &v)?;
        }
        if let Some(v) = self.quantity.as_ref() {
            struct_ser.serialize_field("quantity", v)?;
        }
        if let Some(v) = self.notional.as_ref() {
            struct_ser.serialize_field("notional", v)?;
        }
        if let Some(v) = self.limit_price.as_ref() {
            struct_ser.serialize_field("limitPrice", v)?;
        }
        if let Some(v) = self.stop_price.as_ref() {
            struct_ser.serialize_field("stopPrice", v)?;
        }
        if let Some(v) = self.signal.as_ref() {
            struct_ser.serialize_field("signal", v)?;
        }
        if !self.evidence_refs.is_empty() {
            struct_ser.serialize_field("evidenceRefs", &self.evidence_refs)?;
        }
        if !self.rationale.is_empty() {
            struct_ser.serialize_field("rationale", &self.rationale)?;
        }
        if let Some(v) = self.confidence.as_ref() {
            struct_ser.serialize_field("confidence", v)?;
        }
        if let Some(v) = self.expires_at.as_ref() {
            struct_ser.serialize_field("expiresAt", v)?;
        }
        if self.executable {
            struct_ser.serialize_field("executable", &self.executable)?;
        }
        if !self.counter_views.is_empty() {
            struct_ser.serialize_field("counterViews", &self.counter_views)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for TradeProposal {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "proposal_id",
            "proposalId",
            "account_id",
            "accountId",
            "symbol",
            "action",
            "quantity",
            "notional",
            "limit_price",
            "limitPrice",
            "stop_price",
            "stopPrice",
            "signal",
            "evidence_refs",
            "evidenceRefs",
            "rationale",
            "confidence",
            "expires_at",
            "expiresAt",
            "executable",
            "counter_views",
            "counterViews",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            ProposalId,
            AccountId,
            Symbol,
            Action,
            Quantity,
            Notional,
            LimitPrice,
            StopPrice,
            Signal,
            EvidenceRefs,
            Rationale,
            Confidence,
            ExpiresAt,
            Executable,
            CounterViews,
        }
        impl<'de> serde::Deserialize<'de> for GeneratedField {
            fn deserialize<D>(deserializer: D) -> std::result::Result<GeneratedField, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                struct GeneratedVisitor;

                impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
                    type Value = GeneratedField;

                    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                        write!(formatter, "expected one of: {:?}", &FIELDS)
                    }

                    #[allow(unused_variables)]
                    fn visit_str<E>(self, value: &str) -> std::result::Result<GeneratedField, E>
                    where
                        E: serde::de::Error,
                    {
                        match value {
                            "metadata" => Ok(GeneratedField::Metadata),
                            "proposalId" | "proposal_id" => Ok(GeneratedField::ProposalId),
                            "accountId" | "account_id" => Ok(GeneratedField::AccountId),
                            "symbol" => Ok(GeneratedField::Symbol),
                            "action" => Ok(GeneratedField::Action),
                            "quantity" => Ok(GeneratedField::Quantity),
                            "notional" => Ok(GeneratedField::Notional),
                            "limitPrice" | "limit_price" => Ok(GeneratedField::LimitPrice),
                            "stopPrice" | "stop_price" => Ok(GeneratedField::StopPrice),
                            "signal" => Ok(GeneratedField::Signal),
                            "evidenceRefs" | "evidence_refs" => Ok(GeneratedField::EvidenceRefs),
                            "rationale" => Ok(GeneratedField::Rationale),
                            "confidence" => Ok(GeneratedField::Confidence),
                            "expiresAt" | "expires_at" => Ok(GeneratedField::ExpiresAt),
                            "executable" => Ok(GeneratedField::Executable),
                            "counterViews" | "counter_views" => Ok(GeneratedField::CounterViews),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = TradeProposal;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.trading.v1.TradeProposal")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<TradeProposal, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut proposal_id__ = None;
                let mut account_id__ = None;
                let mut symbol__ = None;
                let mut action__ = None;
                let mut quantity__ = None;
                let mut notional__ = None;
                let mut limit_price__ = None;
                let mut stop_price__ = None;
                let mut signal__ = None;
                let mut evidence_refs__ = None;
                let mut rationale__ = None;
                let mut confidence__ = None;
                let mut expires_at__ = None;
                let mut executable__ = None;
                let mut counter_views__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::ProposalId => {
                            if proposal_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("proposalId"));
                            }
                            proposal_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::AccountId => {
                            if account_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("accountId"));
                            }
                            account_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Symbol => {
                            if symbol__.is_some() {
                                return Err(serde::de::Error::duplicate_field("symbol"));
                            }
                            symbol__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Action => {
                            if action__.is_some() {
                                return Err(serde::de::Error::duplicate_field("action"));
                            }
                            action__ = Some(map_.next_value::<crate::protojson::OpenEnum<ProposalAction>>()?.value);
                        }
                        GeneratedField::Quantity => {
                            if quantity__.is_some() {
                                return Err(serde::de::Error::duplicate_field("quantity"));
                            }
                            quantity__ = map_.next_value()?;
                        }
                        GeneratedField::Notional => {
                            if notional__.is_some() {
                                return Err(serde::de::Error::duplicate_field("notional"));
                            }
                            notional__ = map_.next_value()?;
                        }
                        GeneratedField::LimitPrice => {
                            if limit_price__.is_some() {
                                return Err(serde::de::Error::duplicate_field("limitPrice"));
                            }
                            limit_price__ = map_.next_value()?;
                        }
                        GeneratedField::StopPrice => {
                            if stop_price__.is_some() {
                                return Err(serde::de::Error::duplicate_field("stopPrice"));
                            }
                            stop_price__ = map_.next_value()?;
                        }
                        GeneratedField::Signal => {
                            if signal__.is_some() {
                                return Err(serde::de::Error::duplicate_field("signal"));
                            }
                            signal__ = map_.next_value()?;
                        }
                        GeneratedField::EvidenceRefs => {
                            if evidence_refs__.is_some() {
                                return Err(serde::de::Error::duplicate_field("evidenceRefs"));
                            }
                            evidence_refs__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Rationale => {
                            if rationale__.is_some() {
                                return Err(serde::de::Error::duplicate_field("rationale"));
                            }
                            rationale__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Confidence => {
                            if confidence__.is_some() {
                                return Err(serde::de::Error::duplicate_field("confidence"));
                            }
                            confidence__ = map_.next_value()?;
                        }
                        GeneratedField::ExpiresAt => {
                            if expires_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("expiresAt"));
                            }
                            expires_at__ = map_.next_value()?;
                        }
                        GeneratedField::Executable => {
                            if executable__.is_some() {
                                return Err(serde::de::Error::duplicate_field("executable"));
                            }
                            executable__ = Some(map_.next_value()?);
                        }
                        GeneratedField::CounterViews => {
                            if counter_views__.is_some() {
                                return Err(serde::de::Error::duplicate_field("counterViews"));
                            }
                            counter_views__ = Some(map_.next_value()?);
                        }
                    }
                }
                Ok(TradeProposal {
                    metadata: metadata__,
                    proposal_id: proposal_id__.unwrap_or_default(),
                    account_id: account_id__.unwrap_or_default(),
                    symbol: symbol__.unwrap_or_default(),
                    action: action__.unwrap_or_default(),
                    quantity: quantity__,
                    notional: notional__,
                    limit_price: limit_price__,
                    stop_price: stop_price__,
                    signal: signal__,
                    evidence_refs: evidence_refs__.unwrap_or_default(),
                    rationale: rationale__.unwrap_or_default(),
                    confidence: confidence__,
                    expires_at: expires_at__,
                    executable: executable__.unwrap_or_default(),
                    counter_views: counter_views__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.trading.v1.TradeProposal", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for VenueKind {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "VENUE_KIND_UNSPECIFIED",
            Self::Cex => "VENUE_KIND_CEX",
            Self::Dex => "VENUE_KIND_DEX",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for VenueKind {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "VENUE_KIND_UNSPECIFIED",
            "VENUE_KIND_CEX",
            "VENUE_KIND_DEX",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = VenueKind;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(formatter, "expected one of: {:?}", &FIELDS)
            }

            fn visit_i64<E>(self, v: i64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Signed(v), &self)
                    })
            }

            fn visit_u64<E>(self, v: u64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Unsigned(v), &self)
                    })
            }

            fn visit_str<E>(self, value: &str) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                match value {
                    "VENUE_KIND_UNSPECIFIED" => Ok(VenueKind::Unspecified),
                    "VENUE_KIND_CEX" => Ok(VenueKind::Cex),
                    "VENUE_KIND_DEX" => Ok(VenueKind::Dex),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
